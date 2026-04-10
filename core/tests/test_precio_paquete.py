"""
Tests TDD para core/models/precio_paquete.py

Estos tests exponen bugs en la lógica de precios.
"""
from datetime import date
from decimal import Decimal

from django.test import TestCase

from core.models import PrecioPaquete, Ciclo


class TestGetPrecioIndividualEdgeCases(TestCase):
    """Edge cases para get_precio_individual."""

    def test_precio_individual_no_existe_devuelve_none(self):
        """Cuando no existe precio individual para el tipo/cantidad, devuelve None."""
        # Sin crear ningún precio, buscar uno
        resultado = PrecioPaquete.get_precio_individual('instrumento', 12, ciclo_id=None)
        self.assertIsNone(resultado)

    def test_precio_individual_solo_ciclo_especifico(self):
        """Si solo existe precio para ciclo específico (no global), lo encuentra."""
        ciclo = Ciclo.objects.create(
            nombre='2024', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        PrecioPaquete.objects.create(
            ciclo=ciclo, tipo_taller='instrumento', tipo_paquete='individual',
            cantidad_clases=12, precio_total=Decimal('240.00'),
            precio_por_sesion=Decimal('20.00'), activo=True
        )
        # Con ciclo_id, lo encuentra
        resultado = PrecioPaquete.get_precio_individual('instrumento', 12, ciclo_id=ciclo.id)
        self.assertIsNotNone(resultado)
        self.assertEqual(resultado['precio_total'], 240.0)


class TestCalcularPrecioRecomendadoEdgeCases(TestCase):
    """Edge cases para calcular_precio_recomendado."""

    def setUp(self):
        self.ciclo = Ciclo.objects.create(
            nombre='2024', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        # Crear precios individuales
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='individual',
            cantidad_clases=12, precio_total=Decimal('240.00'),
            precio_por_sesion=Decimal('20.00'), activo=True
        )
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='individual',
            cantidad_clases=8, precio_total=Decimal('160.00'),
            precio_por_sesion=Decimal('20.00'), activo=True
        )
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='individual',
            cantidad_clases=20, precio_total=Decimal('360.00'),
            precio_por_sesion=Decimal('18.00'), activo=True
        )
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='taller', tipo_paquete='individual',
            cantidad_clases=12, precio_total=Decimal('120.00'),
            precio_por_sesion=Decimal('10.00'), activo=True
        )
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='taller', tipo_paquete='individual',
            cantidad_clases=8, precio_total=Decimal('80.00'),
            precio_por_sesion=Decimal('10.00'), activo=True
        )
        # Crear combo musical
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='combo_musical',
            cantidad_clases=12, cantidad_clases_secundaria=8,
            precio_total=Decimal('340.00'),  # 240 + 160 - 60 descuento
            precio_por_sesion=Decimal('17.00'), activo=True
        )
        # Crear mixto
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='mixto',
            cantidad_clases=12, cantidad_clases_secundaria=8,
            precio_total=Decimal('300.00'),  # 240 + 80 - 20 descuento
            precio_por_sesion=Decimal('15.00'), activo=True
        )
        # Intensivo
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='intensivo',
            cantidad_clases=20, precio_total=Decimal('300.00'),
            precio_por_sesion=Decimal('15.00'), activo=True
        )

    def test_lista_vacia_devuelve_none(self):
        """Con lista vacía de matrículas, devuelve None."""
        resultado = PrecioPaquete.calcular_precio_recomendado([], ciclo_id=None)
        self.assertIsNone(resultado)

    def test_sin_precios_en_ciclo_falla_gracefully(self):
        """Si no hay precios en la BD para ese ciclo, cae a global y no crashea."""
        # Crear un ciclo sin precios específicos
        ciclo_vacio = Ciclo.objects.create(
            nombre='Vacio', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        matriculas_data = [{'tipo_taller': 'instrumento', 'cantidad_clases': 12}]
        # No debe crashear aunque no haya precios específicos del ciclo
        # (cae al fallback global)
        resultado = PrecioPaquete.calcular_precio_recomendado(matriculas_data, ciclo_id=ciclo_vacio.id)
        self.assertIsNotNone(resultado)
        self.assertIn('precio_bruto', resultado)
        # Si hay global, usa el global; si no hay global, precio_bruto=0
        self.assertGreaterEqual(resultado['precio_bruto'], 0)

    def test_combo_musical_sin_precio_secundario(self):
        """Combo musical sin precio individual para la secundaria debería caer a individual."""
        # matricular 2 instrumentos pero el segundo (secundaria) no tiene precio
        # Crear solo precio para 12 clases instrumento, NO para 8
        ciclo2 = Ciclo.objects.create(
            nombre='ComboTest', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='individual',
            cantidad_clases=12, precio_total=Decimal('240.00'),
            precio_por_sesion=Decimal('20.00'), activo=True
        )
        # Sin combo_musical 12+8
        matriculas_data = [
            {'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'tipo_taller': 'instrumento', 'cantidad_clases': 8},
        ]
        resultado = PrecioPaquete.calcular_precio_recomendado(matriculas_data, ciclo_id=ciclo2.id)
        # No debe crashear
        self.assertIsNotNone(resultado)
        # Debe ser individual, sin descuento
        self.assertIn(resultado['paquete_detectado'], ('individual', 'combo_musical_12_8'))

    def test_intensivo_sin_precio_individual_20(self):
        """Intensivo sin precio individual para 20 clases no debe crashear."""
        ciclo3 = Ciclo.objects.create(
            nombre='IntensivoTest', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        # Solo precio para 12 clases, no para 20
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='individual',
            cantidad_clases=12, precio_total=Decimal('240.00'),
            precio_por_sesion=Decimal('20.00'), activo=True
        )
        # Intentar calcular intensivo de 20
        matriculas_data = [{'tipo_taller': 'instrumento', 'cantidad_clases': 20}]
        # DEBE CRASHEAR aquí (bug potencial)
        resultado = PrecioPaquete.calcular_precio_recomendado(matriculas_data, ciclo_id=ciclo3.id)
        # Si llega aquí sin crashear, verificar que no devuelve nada extraño
        self.assertIsNotNone(resultado)
        self.assertIn('precio_bruto', resultado)

    def test_intensivo_con_precio_intensivo_pero_sin_individual_20(self):
        """Si existe precio intensivo pero no individual de 20, no crashea."""
        ciclo4 = Ciclo.objects.create(
            nombre='IntensivoBugTest', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        # Precio intensivo existe
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='intensivo',
            cantidad_clases=20, precio_total=Decimal('300.00'),
            precio_por_sesion=Decimal('15.00'), activo=True
        )
        # Pero NO existe individual de 20
        matriculas_data = [{'tipo_taller': 'instrumento', 'cantidad_clases': 20}]
        # Este es el bug: _detectar_intensivo llama get_precio_individual que devuelve None
        # y luego intenta precio_individual['precio_total'] → CRASHA
        try:
            resultado = PrecioPaquete.calcular_precio_recomendado(matriculas_data, ciclo_id=ciclo4.id)
            # Si no crasheó, el bug está arreglado
            self.assertIsNotNone(resultado)
        except TypeError as e:
            # Esto confirma el bug: no debe crashear con TypeError
            self.fail(f"Bug encontrado: _detectar_intensivo crashea cuando no existe precio individual para 20 clases. Error: {e}")

    def test_mixto_sin_precio_para_secundaria(self):
        """Mixto sin precio para la cantidad secundaria no debe crashear."""
        ciclo5 = Ciclo.objects.create(
            nombre='MixtoTest', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='individual',
            cantidad_clases=12, precio_total=Decimal('240.00'),
            precio_por_sesion=Decimal('20.00'), activo=True
        )
        # No hay precio para taller de 8 clases
        matriculas_data = [
            {'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'tipo_taller': 'taller', 'cantidad_clases': 8},
        ]
        try:
            resultado = PrecioPaquete.calcular_precio_recomendado(matriculas_data, ciclo_id=ciclo5.id)
            self.assertIsNotNone(resultado)
        except TypeError as e:
            self.fail(f"Bug: mixto crashea cuando no existe precio individual para la secundaria. Error: {e}")

    def test_combo_musical_sin_precio_primaria_individual(self):
        """Combo musical sin precio individual para la primaria no debe crashear."""
        ciclo6 = Ciclo.objects.create(
            nombre='ComboTest2', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        # Combo existe
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='combo_musical',
            cantidad_clases=12, cantidad_clases_secundaria=8,
            precio_total=Decimal('340.00'),
            precio_por_sesion=Decimal('17.00'), activo=True
        )
        # Pero NO hay individual para 12 ni para 8
        matriculas_data = [
            {'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'tipo_taller': 'instrumento', 'cantidad_clases': 8},
        ]
        try:
            resultado = PrecioPaquete.calcular_precio_recomendado(matriculas_data, ciclo_id=ciclo6.id)
            self.assertIsNotNone(resultado)
        except TypeError as e:
            self.fail(f"Bug: combo_musical crashea cuando no existe precio individual para primaria. Error: {e}")

    def test_combo_musical_precio_bruto_suma_correcta(self):
        """Precio bruto del combo musical debe ser la suma de los individuales."""
        matriculas_data = [
            {'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'tipo_taller': 'instrumento', 'cantidad_clases': 8},
        ]
        resultado = PrecioPaquete.calcular_precio_recomendado(matriculas_data, ciclo_id=None)
        self.assertEqual(resultado['precio_bruto'], 400.0)  # 240 + 160
        self.assertEqual(resultado['descuento'], 60.0)  # 400 - 340
        self.assertEqual(resultado['precio_sugerido'], 340.0)

    def test_mixto_precio_bruto_suma_correcta(self):
        """Precio bruto del mixto debe ser la suma de los individuales."""
        matriculas_data = [
            {'tipo_taller': 'instrumento', 'cantidad_clases': 12},
            {'tipo_taller': 'taller', 'cantidad_clases': 8},
        ]
        resultado = PrecioPaquete.calcular_precio_recomendado(matriculas_data, ciclo_id=None)
        self.assertEqual(resultado['precio_bruto'], 320.0)  # 240 + 80
        self.assertEqual(resultado['descuento'], 20.0)  # 320 - 300
        self.assertEqual(resultado['precio_sugerido'], 300.0)


class TestDetectarIntensivoBug(TestCase):
    """Tests para el bug específico de _detectar_intensivo."""

    def test_detectar_intensivo_sin_precio_individual_no_crashea(self):
        """_detectar_intensivo no debe crashear si no existe precio individual de 20."""
        ciclo = Ciclo.objects.create(
            nombre='BugTest', tipo='anual',
            fecha_inicio=date(2024, 1, 1), fecha_fin=date(2024, 12, 31), activo=True
        )
        # Solo el precio intensivo, sin individual de 20
        PrecioPaquete.objects.create(
            ciclo=None, tipo_taller='instrumento', tipo_paquete='intensivo',
            cantidad_clases=20, precio_total=Decimal('300.00'),
            precio_por_sesion=Decimal('15.00'), activo=True
        )
        matriculas_data = [{'tipo_taller': 'instrumento', 'cantidad_clases': 20}]

        # Este test va a FALLAR si hay un bug en _detectar_intensivo
        resultado = PrecioPaquete._detectar_intensivo(matriculas_data, ciclo_id=None)
        # No debe crashear — si llega aquí, pasó
        self.assertIn('aplica', resultado)
