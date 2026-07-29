"""Motor de precios y detección de promociones para matrículas."""
from dataclasses import dataclass, field
import logging
from decimal import Decimal

from django.db.models import Q

from core.models.precio_paquete import PrecioPaquete

logger = logging.getLogger(__name__)


@dataclass
class PricedItem:
    matricula_id: int | None = None
    tipo_taller: str = ''
    cantidad_clases: int = 0
    precio_individual: float = 0.0
    precio_final: float = 0.0
    descuento: float = 0.0
    promo_aplicada: str | None = None
    precio_por_sesion: float = 0.0


@dataclass
class PricingResult:
    items: list[PricedItem] = field(default_factory=list)
    promos_aplicadas: list[dict] = field(default_factory=list)
    total_bruto: float = 0.0
    total_final: float = 0.0
    descuento_total: float = 0.0
    paquete_aplicado: str = 'individual'


class PriceEngine:
    """Servicio stateless para cálculo de precios y promociones."""

    @staticmethod
    def calculate_individual(tipo_taller: str, sesiones: int, ciclo_id: int | None = None) -> dict:
        """
        Retorna {precio_total, precio_por_sesion} para un tipo y sesiones.
        Busca primero precio configurado para el ciclo, luego global,
        y finalmente usa tarifa base × sesiones.
        """
        precio = PriceEngine._get_individual_price(tipo_taller, sesiones, ciclo_id)
        if precio:
            return precio

        base_rate = PriceEngine._get_base_rate(tipo_taller, ciclo_id)
        if base_rate is None:
            logger.warning(
                'No se encontró tarifa base para tipo_taller=%s ciclo_id=%s sesiones=%s',
                tipo_taller, ciclo_id, sesiones
            )
            return {'precio_total': 0.0, 'precio_por_sesion': 0.0}

        return {
            'precio_total': round(base_rate * sesiones, 2),
            'precio_por_sesion': base_rate,
        }

    @staticmethod
    def _get_individual_price(tipo_taller: str, sesiones: int, ciclo_id: int | None = None) -> dict | None:
        if ciclo_id:
            precio = PrecioPaquete.objects.filter(
                ciclo_id=ciclo_id,
                tipo_taller=tipo_taller,
                tipo_paquete='individual',
                cantidad_clases=sesiones,
                activo=True,
            ).first()
            if precio:
                return {
                    'precio_total': float(precio.precio_total),
                    'precio_por_sesion': float(precio.precio_por_sesion),
                }

        precio = PrecioPaquete.objects.filter(
            ciclo__isnull=True,
            tipo_taller=tipo_taller,
            tipo_paquete='individual',
            cantidad_clases=sesiones,
            activo=True,
        ).first()
        if precio:
            return {
                'precio_total': float(precio.precio_total),
                'precio_por_sesion': float(precio.precio_por_sesion),
            }
        return None

    @staticmethod
    def _get_base_rate(tipo_taller: str, ciclo_id: int | None = None) -> float | None:
        resultado = PriceEngine._get_individual_price(tipo_taller, 1, ciclo_id)
        if resultado:
            return resultado['precio_por_sesion']
        return None

    @staticmethod
    def _get_promo_price(
        tipo_paquete: str,
        tipo_taller: str,
        cantidad_clases: int,
        cantidad_clases_secundaria: int | None,
        ciclo_id: int | None,
    ) -> PrecioPaquete | None:
        if ciclo_id:
            precio = PrecioPaquete.objects.filter(
                ciclo_id=ciclo_id,
                tipo_taller=tipo_taller,
                tipo_paquete=tipo_paquete,
                cantidad_clases=cantidad_clases,
                cantidad_clases_secundaria=cantidad_clases_secundaria,
                activo=True,
            ).first()
            if precio:
                return precio

        return PrecioPaquete.objects.filter(
            ciclo__isnull=True,
            tipo_taller=tipo_taller,
            tipo_paquete=tipo_paquete,
            cantidad_clases=cantidad_clases,
            cantidad_clases_secundaria=cantidad_clases_secundaria,
            activo=True,
        ).first()

    @staticmethod
    def _fetch_promos(tipo_paquete: str, ciclo_id: int | None) -> list[PrecioPaquete]:
        """Retorna promos activas ordenadas por descuento descendente."""
        qs = PrecioPaquete.objects.filter(
            Q(ciclo_id=ciclo_id) | Q(ciclo__isnull=True),
            tipo_paquete=tipo_paquete,
            activo=True,
        )

        # Preferir precio de ciclo sobre global si ambos existen
        seen = set()
        promos = []
        for promo in qs:
            key = (promo.tipo_taller, promo.cantidad_clases, promo.cantidad_clases_secundaria or 0)
            if key in seen:
                continue
            seen.add(key)
            if promo.ciclo_id == ciclo_id:
                promos.insert(0, promo)
            else:
                promos.append(promo)

        def _discount(promo: PrecioPaquete) -> float:
            if tipo_paquete in ('combo_musical', 'mixto'):
                if not promo.cantidad_clases_secundaria:
                    return 0.0  # ponytail: incomplete promo data, skip
                p1 = PriceEngine.calculate_individual('instrumento', promo.cantidad_clases, ciclo_id)
                tipo2 = 'instrumento' if tipo_paquete == 'combo_musical' else 'taller'
                p2 = PriceEngine.calculate_individual(tipo2, promo.cantidad_clases_secundaria, ciclo_id)
                return (p1['precio_total'] + p2['precio_total']) - float(promo.precio_total)
            return 0.0

        return sorted(promos, key=_discount, reverse=True)

    @staticmethod
    def _greedy_match(
        matriculas_data: list[dict], ciclo_id: int
    ) -> tuple[list[PricedItem], list[dict], list[dict]]:
        """
        Ejecuta matching greedy de promos: combo_musical → mixto → intensivo.
        Retorna (items de promos, resumen de promos, matrículas sin match).
        """
        items: list[PricedItem] = []
        promos_aplicadas: list[dict] = []
        unmatched = list(matriculas_data)

        def _pop_by_id(matricula_id: int) -> list[dict]:
            return [m for m in unmatched if m['id'] != matricula_id]

        def _instrumentos() -> list[dict]:
            return [m for m in unmatched if m['tipo_taller'] == 'instrumento']

        def _talleres() -> list[dict]:
            return [m for m in unmatched if m['tipo_taller'] == 'taller']

        def _build_priced_items(
            matched: list[dict],
            promo_total: float,
            promo_name: str,
        ) -> list[PricedItem]:
            individuals = [PriceEngine.calculate_individual(m['tipo_taller'], m['cantidad_clases'], ciclo_id) for m in matched]
            total_individual = sum(p['precio_total'] for p in individuals)

            if total_individual <= 0:
                share = promo_total / len(matched)
                finals = [share] * len(matched)
            else:
                finals = [promo_total * (p['precio_total'] / total_individual) for p in individuals]

            # Redondear cada precio final a múltiplo de 5
            finals_rounded = [round(f / 5) * 5 for f in finals]

            # Ajustar el último para que la suma coincida con promo_total
            diff = round(promo_total - sum(finals_rounded), 2)
            if diff != 0.0 and finals_rounded:
                finals_rounded[-1] = round(finals_rounded[-1] + diff, 2)

            priced_items = []
            for m, p, final in zip(matched, individuals, finals_rounded):
                descuento = round(p['precio_total'] - final, 2)
                precio_por_sesion = round(final / m['cantidad_clases'], 2) if m['cantidad_clases'] else 0.0
                priced_items.append(
                    PricedItem(
                        matricula_id=m['id'],
                        tipo_taller=m['tipo_taller'],
                        cantidad_clases=m['cantidad_clases'],
                        precio_individual=p['precio_total'],
                        precio_final=final,
                        descuento=descuento,
                        promo_aplicada=promo_name,
                        precio_por_sesion=precio_por_sesion,
                    )
                )

            return priced_items

        # 1) Combo musical
        for promo in PriceEngine._fetch_promos('combo_musical', ciclo_id):
            primaria = promo.cantidad_clases
            secundaria = promo.cantidad_clases_secundaria
            promo_name = f'combo_musical_{primaria}_{secundaria}'
            promo_total = float(promo.precio_total)

            while True:
                instrumentos = _instrumentos()
                idx_primaria = next(
                    (i for i, m in enumerate(instrumentos) if m['cantidad_clases'] == primaria), None
                )
                if idx_primaria is None:
                    break

                candidatos_secundarios = [
                    (i, m) for i, m in enumerate(instrumentos)
                    if m['cantidad_clases'] == secundaria and i != idx_primaria
                ]
                if not candidatos_secundarios:
                    break

                m1 = instrumentos[idx_primaria]
                m2 = candidatos_secundarios[0][1]
                matched = [m1, m2]
                unmatched = _pop_by_id(m1['id'])
                unmatched = _pop_by_id(m2['id'])

                priced_items = _build_priced_items(matched, promo_total, promo_name)
                items.extend(priced_items)
                promos_aplicadas.append(
                    {
                        'tipo': promo_name,
                        'matricula_ids': [m['id'] for m in matched],
                        'descuento': round(sum(pi.descuento for pi in priced_items), 2),
                    }
                )

        # 2) Mixto
        for promo in PriceEngine._fetch_promos('mixto', ciclo_id):
            primaria = promo.cantidad_clases
            secundaria = promo.cantidad_clases_secundaria
            promo_name = f'mixto_{primaria}_{secundaria}'
            promo_total = float(promo.precio_total)

            while True:
                instrumentos = _instrumentos()
                talleres = _talleres()
                idx_inst = next(
                    (i for i, m in enumerate(instrumentos) if m['cantidad_clases'] == primaria), None
                )
                idx_taller = next(
                    (i for i, m in enumerate(talleres) if m['cantidad_clases'] == secundaria), None
                )
                if idx_inst is None or idx_taller is None:
                    break

                m_inst = instrumentos[idx_inst]
                m_taller = talleres[idx_taller]
                matched = [m_inst, m_taller]
                unmatched = _pop_by_id(m_inst['id'])
                unmatched = _pop_by_id(m_taller['id'])

                priced_items = _build_priced_items(matched, promo_total, promo_name)
                items.extend(priced_items)
                promos_aplicadas.append(
                    {
                        'tipo': promo_name,
                        'matricula_ids': [m['id'] for m in matched],
                        'descuento': round(sum(pi.descuento for pi in priced_items), 2),
                    }
                )

        # 3) Intensivo
        for m in list(unmatched):
            if m['cantidad_clases'] == 20:
                promo = PriceEngine._get_promo_price('intensivo', m['tipo_taller'], 20, None, ciclo_id)
                if promo:
                    promo_name = f"intensivo_{m['tipo_taller']}"
                    promo_total = float(promo.precio_total)
                    priced_items = _build_priced_items([m], promo_total, promo_name)
                    items.extend(priced_items)
                    promos_aplicadas.append(
                        {
                            'tipo': promo_name,
                            'matricula_ids': [m['id']],
                            'descuento': round(sum(pi.descuento for pi in priced_items), 2),
                        }
                    )
                    unmatched = _pop_by_id(m['id'])

        return items, promos_aplicadas, unmatched

    @staticmethod
    def calculate(matriculas_data: list[dict], ciclo_id: int) -> PricingResult:
        """
        Calcula precios y promociones para una lista de matrículas.

        matriculas_data: [{'id': int, 'tipo_taller': str, 'cantidad_clases': int}, ...]
        """
        priced_items, promos_aplicadas, unmatched = PriceEngine._greedy_match(matriculas_data, ciclo_id)

        for m in unmatched:
            individual = PriceEngine.calculate_individual(m['tipo_taller'], m['cantidad_clases'], ciclo_id)
            priced_items.append(
                PricedItem(
                    matricula_id=m['id'],
                    tipo_taller=m['tipo_taller'],
                    cantidad_clases=m['cantidad_clases'],
                    precio_individual=individual['precio_total'],
                    precio_final=individual['precio_total'],
                    descuento=0.0,
                    promo_aplicada=None,
                    precio_por_sesion=individual['precio_por_sesion'],
                )
            )

        total_bruto = sum(item.precio_individual for item in priced_items)
        total_final = sum(item.precio_final for item in priced_items)
        descuento_total = sum(item.descuento for item in priced_items)

        paquete_aplicado = 'individual'
        if promos_aplicadas:
            paquete_aplicado = ','.join(p['tipo'] for p in promos_aplicadas)

        return PricingResult(
            items=priced_items,
            promos_aplicadas=promos_aplicadas,
            total_bruto=round(total_bruto, 2),
            total_final=round(total_final, 2),
            descuento_total=round(descuento_total, 2),
            paquete_aplicado=paquete_aplicado,
        )
