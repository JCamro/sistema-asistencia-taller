from django.test import TestCase

from core.models import Ciclo
from core.models.precio_paquete import PrecioPaquete
from core.services.price_engine import PriceEngine


class TestPriceEngine(TestCase):
    def setUp(self):
        self.ciclo = Ciclo.objects.create(
            nombre='Ciclo 2026',
            tipo='anual',
            fecha_inicio='2026-01-01',
            fecha_fin='2026-12-31',
        )

        # Precios individuales globales
        self._individual('instrumento', 1, 20.00)
        self._individual('instrumento', 8, 120.00)
        self._individual('instrumento', 12, 240.00)
        self._individual('taller', 1, 20.00)
        self._individual('taller', 8, 80.00)
        self._individual('taller', 12, 180.00)

        # Promos globales
        self._promo('combo_musical', 'instrumento', 12, 12, 400.00)
        self._promo('combo_musical', 'instrumento', 8, 8, 200.00)
        self._promo('combo_musical', 'instrumento', 12, 8, 300.00)
        self._promo('mixto', 'instrumento', 12, 8, 300.00)
        self._promo('intensivo', 'instrumento', 20, None, 300.00)
        self._promo('intensivo', 'taller', 20, None, 250.00)

    def _individual(self, tipo_taller, sesiones, total):
        PrecioPaquete.objects.create(
            ciclo=None,
            tipo_taller=tipo_taller,
            tipo_paquete='individual',
            cantidad_clases=sesiones,
            cantidad_clases_secundaria=None,
            precio_total=total,
            precio_por_sesion=round(total / sesiones, 2),
            activo=True,
        )

    def _promo(self, tipo_paquete, tipo_taller, clases, clases_sec, total):
        sesiones_totales = clases + (clases_sec or 0)
        PrecioPaquete.objects.create(
            ciclo=None,
            tipo_taller=tipo_taller,
            tipo_paquete=tipo_paquete,
            cantidad_clases=clases,
            cantidad_clases_secundaria=clases_sec,
            precio_total=total,
            precio_por_sesion=round(total / sesiones_totales, 2),
            activo=True,
        )

    # ---- calculate_individual ----

    def test_calculate_individual_configured_price_found(self):
        result = PriceEngine.calculate_individual('instrumento', 12, None)
        self.assertEqual(result['precio_total'], 240.00)
        self.assertEqual(result['precio_por_sesion'], 20.00)

    def test_calculate_individual_cycle_price_takes_precedence(self):
        PrecioPaquete.objects.create(
            ciclo=self.ciclo,
            tipo_taller='instrumento',
            tipo_paquete='individual',
            cantidad_clases=12,
            cantidad_clases_secundaria=None,
            precio_total=220.00,
            precio_por_sesion=18.33,
            activo=True,
        )
        result = PriceEngine.calculate_individual('instrumento', 12, self.ciclo.id)
        self.assertEqual(result['precio_total'], 220.00)

    def test_calculate_individual_auto_price_with_base_rate(self):
        result = PriceEngine.calculate_individual('instrumento', 15, None)
        self.assertEqual(result['precio_total'], 300.00)
        self.assertEqual(result['precio_por_sesion'], 20.00)

    def test_calculate_individual_auto_price_no_base_rate_returns_zero(self):
        result = PriceEngine.calculate_individual('desconocido', 15, None)
        self.assertEqual(result['precio_total'], 0.0)
        self.assertEqual(result['precio_por_sesion'], 0.0)

    # ---- _greedy_match ----

    def _find_item(self, items, matricula_id):
        return next(item for item in items if item.matricula_id == matricula_id)

    def test_greedy_match_two_matching_instruments(self):
        data = [
            {'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 2, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
        ]
        items, promos, unmatched = PriceEngine._greedy_match(data, None)

        self.assertEqual(len(items), 2)
        self.assertEqual(len(unmatched), 0)
        self.assertEqual(len(promos), 1)
        self.assertEqual(promos[0]['tipo'], 'combo_musical_12_12')

        for item in items:
            self.assertEqual(item.promo_aplicada, 'combo_musical_12_12')

        self.assertEqual(sum(item.precio_final for item in items), 400.00)
        self.assertEqual(sum(item.descuento for item in items), 80.00)

    def test_greedy_match_three_instruments(self):
        data = [
            {'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 2, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 3, 'tipo_taller': 'instrumento', 'cantidad_clases': 8},
        ]
        result = PriceEngine.calculate(data, None)

        self.assertEqual(len(result.items), 3)
        combo_items = [item for item in result.items if item.promo_aplicada == 'combo_musical_12_12']
        individual_items = [item for item in result.items if item.promo_aplicada is None]

        self.assertEqual(len(combo_items), 2)
        self.assertEqual(len(individual_items), 1)
        self.assertEqual(individual_items[0].matricula_id, 3)
        self.assertEqual(individual_items[0].precio_final, 120.00)
        self.assertEqual(result.total_final, 520.00)

    def test_greedy_match_asymmetric_combo(self):
        data = [
            {'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 2, 'tipo_taller': 'instrumento', 'cantidad_clases': 8},
        ]
        items, promos, unmatched = PriceEngine._greedy_match(data, None)

        self.assertEqual(len(items), 2)
        self.assertEqual(len(unmatched), 0)
        self.assertEqual(promos[0]['tipo'], 'combo_musical_12_8')

        item_12 = self._find_item(items, 1)
        item_8 = self._find_item(items, 2)
        self.assertEqual(item_12.precio_final, 200.00)
        self.assertEqual(item_8.precio_final, 100.00)
        self.assertEqual(item_12.descuento, 40.00)
        self.assertEqual(item_8.descuento, 20.00)

    def test_greedy_match_instrument_taller_mixto(self):
        data = [
            {'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 2, 'tipo_taller': 'taller', 'cantidad_clases': 8},
        ]
        items, promos, unmatched = PriceEngine._greedy_match(data, None)

        self.assertEqual(len(items), 2)
        self.assertEqual(len(unmatched), 0)
        self.assertEqual(promos[0]['tipo'], 'mixto_12_8')

        item_inst = self._find_item(items, 1)
        item_taller = self._find_item(items, 2)
        self.assertEqual(item_inst.promo_aplicada, 'mixto_12_8')
        self.assertEqual(item_taller.promo_aplicada, 'mixto_12_8')
        self.assertEqual(sum(item.precio_final for item in items), 300.00)

    def test_greedy_match_no_mixto_match(self):
        data = [
            {'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 2, 'tipo_taller': 'instrumento', 'cantidad_clases': 8},
        ]
        items, promos, unmatched = PriceEngine._greedy_match(data, None)

        self.assertEqual(len(promos), 1)
        self.assertEqual(promos[0]['tipo'], 'combo_musical_12_8')
        self.assertEqual(len(unmatched), 0)

    def test_greedy_match_intensivo(self):
        data = [
            {'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 20},
        ]
        items, promos, unmatched = PriceEngine._greedy_match(data, None)

        self.assertEqual(len(items), 1)
        self.assertEqual(len(unmatched), 0)
        self.assertEqual(promos[0]['tipo'], 'intensivo_instrumento')
        self.assertEqual(items[0].precio_final, 300.00)
        self.assertEqual(items[0].descuento, 100.00)

    def test_greedy_match_intensivo_no_config_fallback(self):
        data = [
            {'id': 1, 'tipo_taller': 'taller', 'cantidad_clases': 20},
        ]
        # Usamos un tipo sin precio intensivo configurado
        PrecioPaquete.objects.filter(tipo_paquete='intensivo', tipo_taller='taller').delete()
        items, promos, unmatched = PriceEngine._greedy_match(data, None)

        self.assertEqual(len(items), 0)
        self.assertEqual(len(promos), 0)
        self.assertEqual(len(unmatched), 1)

    # ---- calculate end-to-end ----

    def test_calculate_single_matricula(self):
        data = [{'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 8}]
        result = PriceEngine.calculate(data, None)

        self.assertEqual(result.total_final, 120.00)
        self.assertEqual(result.paquete_aplicado, 'individual')
        self.assertEqual(len(result.items), 1)
        self.assertIsNone(result.items[0].promo_aplicada)

    def test_calculate_combo_musical(self):
        data = [
            {'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 2, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
        ]
        result = PriceEngine.calculate(data, None)

        self.assertEqual(result.total_bruto, 480.00)
        self.assertEqual(result.total_final, 400.00)
        self.assertEqual(result.descuento_total, 80.00)
        self.assertEqual(result.paquete_aplicado, 'combo_musical_12_12')

    def test_calculate_mixto(self):
        data = [
            {'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 2, 'tipo_taller': 'taller', 'cantidad_clases': 8},
        ]
        result = PriceEngine.calculate(data, None)

        self.assertEqual(result.total_bruto, 320.00)
        self.assertEqual(result.total_final, 300.00)
        self.assertEqual(result.descuento_total, 20.00)
        self.assertEqual(result.paquete_aplicado, 'mixto_12_8')

    def test_calculate_intensivo(self):
        data = [{'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 20}]
        result = PriceEngine.calculate(data, None)

        self.assertEqual(result.total_bruto, 400.00)
        self.assertEqual(result.total_final, 300.00)
        self.assertEqual(result.descuento_total, 100.00)
        self.assertEqual(result.paquete_aplicado, 'intensivo_instrumento')

    def test_calculate_mixed(self):
        data = [
            {'id': 1, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 2, 'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'id': 3, 'tipo_taller': 'instrumento', 'cantidad_clases': 20},
        ]
        result = PriceEngine.calculate(data, None)

        self.assertEqual(result.total_bruto, 880.00)
        self.assertEqual(result.total_final, 700.00)
        self.assertEqual(result.descuento_total, 180.00)
        # Ambas promos aplicadas se guardan en paquete_aplicado
        self.assertIn('combo_musical_12_12', result.paquete_aplicado)
        self.assertIn('intensivo_instrumento', result.paquete_aplicado)

    def test_calculate_empty_list(self):
        result = PriceEngine.calculate([], None)

        self.assertEqual(result.total_final, 0.0)
        self.assertEqual(result.paquete_aplicado, 'individual')
        self.assertEqual(len(result.items), 0)
