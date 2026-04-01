from django.core.management.base import BaseCommand
from core.models import PrecioPaquete


class Command(BaseCommand):
    help = 'Sembrar precios de paquetes iniciales'

    def handle(self, *args, **options):
        self.stdout.write('Sembrando precios de paquetes...')

        # Precios individuales - Instrumento
        precios_instrumento = [
            {'cantidad_clases': 1, 'precio_total': 20.00, 'precio_por_sesion': 20.00},
            {'cantidad_clases': 8, 'precio_total': 160.00, 'precio_por_sesion': 20.00},
            {'cantidad_clases': 12, 'precio_total': 200.00, 'precio_por_sesion': 16.67},
        ]

        for precio in precios_instrumento:
            PrecioPaquete.objects.update_or_create(
                tipo_taller='instrumento',
                tipo_paquete='individual',
                cantidad_clases=precio['cantidad_clases'],
                defaults={
                    'precio_total': precio['precio_total'],
                    'precio_por_sesion': precio['precio_por_sesion'],
                    'activo': True
                }
            )
            self.stdout.write(f"  - Instrumento individual {precio['cantidad_clases']} clases: S/. {precio['precio_total']}")

        # Precios individuales - Taller
        precios_taller = [
            {'cantidad_clases': 1, 'precio_total': 20.00, 'precio_por_sesion': 20.00},
            {'cantidad_clases': 8, 'precio_total': 140.00, 'precio_por_sesion': 17.50},
            {'cantidad_clases': 12, 'precio_total': 180.00, 'precio_por_sesion': 15.00},
        ]

        for precio in precios_taller:
            PrecioPaquete.objects.update_or_create(
                tipo_taller='taller',
                tipo_paquete='individual',
                cantidad_clases=precio['cantidad_clases'],
                defaults={
                    'precio_total': precio['precio_total'],
                    'precio_por_sesion': precio['precio_por_sesion'],
                    'activo': True
                }
            )
            self.stdout.write(f"  - Taller individual {precio['cantidad_clases']} clases: S/. {precio['precio_total']}")

        # Combo Musical (2 instrumentos)
        combos_musicales = [
            {'cantidad_clases': 12, 'precio_total': 360.00, 'precio_por_sesion': 15.00},
            {'cantidad_clases': 8, 'precio_total': 290.00, 'precio_por_sesion': 18.13},
        ]

        for combo in combos_musicales:
            PrecioPaquete.objects.update_or_create(
                tipo_taller='instrumento',
                tipo_paquete='combo_musical',
                cantidad_clases=combo['cantidad_clases'],
                defaults={
                    'precio_total': combo['precio_total'],
                    'precio_por_sesion': combo['precio_por_sesion'],
                    'activo': True
                }
            )
            self.stdout.write(f"  - Combo Musical {combo['cantidad_clases']}+{combo['cantidad_clases']}: S/. {combo['precio_total']}")

        # Mixto (instrumento + taller)
        mixtos = [
            {'cantidad_clases': 12, 'precio_total': 340.00, 'precio_por_sesion': 15.00},
            {'cantidad_clases': 8, 'precio_total': 270.00, 'precio_por_sesion': 15.63},
        ]

        for mixto in mixtos:
            PrecioPaquete.objects.update_or_create(
                tipo_taller='instrumento',
                tipo_paquete='mixto',
                cantidad_clases=mixto['cantidad_clases'],
                defaults={
                    'precio_total': mixto['precio_total'],
                    'precio_por_sesion': mixto['precio_por_sesion'],
                    'activo': True
                }
            )
            self.stdout.write(f"  - Mixto {mixto['cantidad_clases']}+{mixto['cantidad_clases']}: S/. {mixto['precio_total']}")

        # Intensivo
        intensivos = [
            {'tipo': 'instrumento', 'cantidad_clases': 20, 'precio_total': 300.00, 'precio_por_sesion': 15.00},
            {'tipo': 'taller', 'cantidad_clases': 20, 'precio_total': 250.00, 'precio_por_sesion': 12.50},
        ]

        for intensivo in intensivos:
            PrecioPaquete.objects.update_or_create(
                tipo_taller=intensivo['tipo'],
                tipo_paquete='intensivo',
                cantidad_clases=intensivo['cantidad_clases'],
                defaults={
                    'precio_total': intensivo['precio_total'],
                    'precio_por_sesion': intensivo['precio_por_sesion'],
                    'activo': True
                }
            )
            self.stdout.write(f"  - Intensivo {intensivo['tipo']} {intensivo['cantidad_clases']} clases: S/. {intensivo['precio_total']}")

        self.stdout.write(self.style.SUCCESS('¡Precios sembrados exitosamente!'))
