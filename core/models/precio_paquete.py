from django.db import models


class PrecioPaquete(models.Model):
    TIPO_TALLER_CHOICES = [
        ('instrumento', 'Instrumento'),
        ('taller', 'Taller'),
    ]

    TIPO_PAQUETE_CHOICES = [
        ('individual', 'Individual'),
        ('combo_musical', 'Combo Musical (2 Instrumentos)'),
        ('mixto', 'Mixto (Instrumento + Taller)'),
        ('intensivo', 'Intensivo'),
    ]

    CANTIDAD_CLASES_CHOICES = [
        (1, 'Clase suelta'),
        (8, 'Paquete 8 clases'),
        (12, 'Paquete 12 clases'),
        (20, 'Paquete 20 clases'),
    ]

    tipo_taller = models.CharField(
        max_length=20,
        choices=TIPO_TALLER_CHOICES,
        verbose_name='Tipo de Taller'
    )
    tipo_paquete = models.CharField(
        max_length=20,
        choices=TIPO_PAQUETE_CHOICES,
        default='individual',
        verbose_name='Tipo de Paquete'
    )
    cantidad_clases = models.IntegerField(
        choices=CANTIDAD_CLASES_CHOICES,
        verbose_name='Cantidad de Clases'
    )
    precio_total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Precio Total'
    )
    precio_por_sesion = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Precio por Sesión'
    )
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['tipo_paquete', 'tipo_taller', 'cantidad_clases']
        unique_together = ['tipo_taller', 'tipo_paquete', 'cantidad_clases']
        verbose_name = 'Precio de Paquete'
        verbose_name_plural = 'Precios de Paquetes'

    def __str__(self):
        return f"{self.get_tipo_paquete_display()} - {self.get_tipo_taller_display()} - {self.cantidad_clases} clases: S/. {self.precio_total}"

    @classmethod
    def get_precio_individual(cls, tipo_taller, cantidad_clases):
        """Obtiene precio para un paquete individual"""
        try:
            precio = cls.objects.get(
                tipo_taller=tipo_taller,
                tipo_paquete='individual',
                cantidad_clases=cantidad_clases,
                activo=True
            )
            return {
                'precio_total': float(precio.precio_total),
                'precio_por_sesion': float(precio.precio_por_sesion)
            }
        except cls.DoesNotExist:
            return None

    @classmethod
    def calcular_precio_recomendado(cls, matriculas_data):
        """
        Calcula el precio recomendado basado en las matrículas.
        Detecta automáticamente paquetes promocionales.

        matriculas_data: lista de dicts con 'tipo_taller', 'cantidad_clases'
        """
        if not matriculas_data:
            return None

        # Separar por tipo
        instrumentos = [m for m in matriculas_data if m['tipo_taller'] == 'instrumento']
        talleres = [m for m in matriculas_data if m['tipo_taller'] == 'taller']

        total_bruto = 0
        descuento = 0
        paquete_detectado = 'individual'
        desglose = []

        # Calcular precio bruto individual
        for m in matriculas_data:
            precio = cls.get_precio_individual(m['tipo_taller'], m['cantidad_clases'])
            if precio:
                total_bruto += precio['precio_total']

        # Detectar Combo Musical (2 instrumentos)
        if len(instrumentos) >= 2:
            combos = cls._detectar_combo_musical(instrumentos)
            if combos['aplica']:
                descuento = combos['descuento']
                paquete_detectado = combos['tipo']
                desglose = combos['desglose']

        # Detectar Mixto (1 instrumento + 1 taller)
        elif len(instrumentos) == 1 and len(talleres) == 1:
            mixto = cls._detectar_mixto(instrumentos[0], talleres[0])
            if mixto['aplica']:
                descuento = mixto['descuento']
                paquete_detectado = mixto['tipo']
                desglose = mixto['desglose']

        # Detectar Intensivo (20 clases)
        elif any(m['cantidad_clases'] == 20 for m in matriculas_data):
            intensivo = cls._detectar_intensivo(matriculas_data)
            if intensivo['aplica']:
                descuento = intensivo['descuento']
                paquete_detectado = intensivo['tipo']
                desglose = intensivo['desglose']

        # Si no hay promoción, usar precios individuales
        if not desglose:
            for m in matriculas_data:
                precio = cls.get_precio_individual(m['tipo_taller'], m['cantidad_clases'])
                if precio:
                    desglose.append({
                        'tipo_taller': m['tipo_taller'],
                        'cantidad_clases': m['cantidad_clases'],
                        'precio': precio['precio_total']
                    })

        precio_sugerido = total_bruto - descuento

        return {
            'precio_bruto': round(total_bruto, 2),
            'descuento': round(descuento, 2),
            'precio_sugerido': round(precio_sugerido, 2),
            'paquete_detectado': paquete_detectado,
            'desglose': desglose
        }

    @classmethod
    def _detectar_combo_musical(cls, instrumentos):
        """Detecta combo musical (2 instrumentos)"""
        # Ordenar por cantidad de clases para buscar coincidencias
        inst_ordenados = sorted(instrumentos, key=lambda x: x['cantidad_clases'], reverse=True)

        # Buscar 12+12
        if len([i for i in inst_ordenados if i['cantidad_clases'] == 12]) >= 2:
            try:
                combo = cls.objects.get(
                    tipo_paquete='combo_musical',
                    cantidad_clases=12,
                    activo=True
                )
                precio_individual = sum(
                    cls.get_precio_individual(i['tipo_taller'], 12)['precio_total']
                    for i in inst_ordenados[:2]
                )
                descuento = precio_individual - float(combo.precio_total)
                return {
                    'aplica': True,
                    'tipo': 'combo_musical_12',
                    'descuento': descuento,
                    'desglose': [
                        {'tipo_taller': 'instrumento', 'cantidad_clases': 12, 'precio': float(combo.precio_total) / 2},
                        {'tipo_taller': 'instrumento', 'cantidad_clases': 12, 'precio': float(combo.precio_total) / 2}
                    ]
                }
            except cls.DoesNotExist:
                pass

        # Buscar 8+8
        if len([i for i in inst_ordenados if i['cantidad_clases'] == 8]) >= 2:
            try:
                combo = cls.objects.get(
                    tipo_paquete='combo_musical',
                    cantidad_clases=8,
                    activo=True
                )
                precio_individual = sum(
                    cls.get_precio_individual(i['tipo_taller'], 8)['precio_total']
                    for i in inst_ordenados[:2]
                )
                descuento = precio_individual - float(combo.precio_total)
                return {
                    'aplica': True,
                    'tipo': 'combo_musical_8',
                    'descuento': descuento,
                    'desglose': [
                        {'tipo_taller': 'instrumento', 'cantidad_clases': 8, 'precio': float(combo.precio_total) / 2},
                        {'tipo_taller': 'instrumento', 'cantidad_clases': 8, 'precio': float(combo.precio_total) / 2}
                    ]
                }
            except cls.DoesNotExist:
                pass

        # Buscar 12+8
        if any(i['cantidad_clases'] == 12 for i in inst_ordenados) and any(i['cantidad_clases'] == 8 for i in inst_ordenados):
            try:
                combo = cls.objects.get(
                    tipo_paquete='combo_musical',
                    cantidad_clases=12,  # Usamos 12 como referencia para 12+8
                    activo=True
                )
                precio_individual = (
                    cls.get_precio_individual('instrumento', 12)['precio_total'] +
                    cls.get_precio_individual('instrumento', 8)['precio_total']
                )
                # Precio especial para 12+8
                precio_combo = 330.00
                descuento = precio_individual - precio_combo
                return {
                    'aplica': True,
                    'tipo': 'combo_musical_12_8',
                    'descuento': descuento,
                    'desglose': [
                        {'tipo_taller': 'instrumento', 'cantidad_clases': 12, 'precio': 165.00},
                        {'tipo_taller': 'instrumento', 'cantidad_clases': 8, 'precio': 165.00}
                    ]
                }
            except cls.DoesNotExist:
                pass

        return {'aplica': False, 'descuento': 0, 'desglose': []}

    @classmethod
    def _detectar_mixto(cls, instrumento, taller):
        """Detecta mixto (instrumento + taller)"""
        # Buscar 12+12
        if instrumento['cantidad_clases'] == 12 and taller['cantidad_clases'] == 12:
            try:
                mixto = cls.objects.get(
                    tipo_paquete='mixto',
                    cantidad_clases=12,
                    activo=True
                )
                precio_individual = (
                    cls.get_precio_individual('instrumento', 12)['precio_total'] +
                    cls.get_precio_individual('taller', 12)['precio_total']
                )
                descuento = precio_individual - float(mixto.precio_total)
                return {
                    'aplica': True,
                    'tipo': 'mixto_12',
                    'descuento': descuento,
                    'desglose': [
                        {'tipo_taller': 'instrumento', 'cantidad_clases': 12, 'precio': 200.00},
                        {'tipo_taller': 'taller', 'cantidad_clases': 12, 'precio': 140.00}
                    ]
                }
            except cls.DoesNotExist:
                pass

        # Buscar 8+8
        if instrumento['cantidad_clases'] == 8 and taller['cantidad_clases'] == 8:
            try:
                mixto = cls.objects.get(
                    tipo_paquete='mixto',
                    cantidad_clases=8,
                    activo=True
                )
                precio_individual = (
                    cls.get_precio_individual('instrumento', 8)['precio_total'] +
                    cls.get_precio_individual('taller', 8)['precio_total']
                )
                descuento = precio_individual - float(mixto.precio_total)
                return {
                    'aplica': True,
                    'tipo': 'mixto_8',
                    'descuento': descuento,
                    'desglose': [
                        {'tipo_taller': 'instrumento', 'cantidad_clases': 8, 'precio': 145.00},
                        {'tipo_taller': 'taller', 'cantidad_clases': 8, 'precio': 125.00}
                    ]
                }
            except cls.DoesNotExist:
                pass

        # Buscar 12+8
        if instrumento['cantidad_clases'] == 12 and taller['cantidad_clases'] == 8:
            precio_individual = (
                cls.get_precio_individual('instrumento', 12)['precio_total'] +
                cls.get_precio_individual('taller', 8)['precio_total']
            )
            precio_mixto = 310.00
            descuento = precio_individual - precio_mixto
            return {
                'aplica': True,
                'tipo': 'mixto_12_8',
                'descuento': descuento,
                'desglose': [
                    {'tipo_taller': 'instrumento', 'cantidad_clases': 12, 'precio': 170.00},
                    {'tipo_taller': 'taller', 'cantidad_clases': 8, 'precio': 140.00}
                ]
            }

        return {'aplica': False, 'descuento': 0, 'desglose': []}

    @classmethod
    def _detectar_intensivo(cls, matriculas_data):
        """Detecta paquete intensivo (20 clases)"""
        for m in matriculas_data:
            if m['cantidad_clases'] == 20:
                try:
                    intensivo = cls.objects.get(
                        tipo_paquete='intensivo',
                        tipo_taller=m['tipo_taller'],
                        cantidad_clases=20,
                        activo=True
                    )
                    precio_individual = cls.get_precio_individual(m['tipo_taller'], 20)
                    if precio_individual:
                        descuento = precio_individual['precio_total'] - float(intensivo.precio_total)
                        return {
                            'aplica': True,
                            'tipo': f'intensivo_{m["tipo_taller"]}',
                            'descuento': descuento,
                            'desglose': [
                                {'tipo_taller': m['tipo_taller'], 'cantidad_clases': 20, 'precio': float(intensivo.precio_total)}
                            ]
                        }
                except cls.DoesNotExist:
                    pass

        return {'aplica': False, 'descuento': 0, 'desglose': []}
