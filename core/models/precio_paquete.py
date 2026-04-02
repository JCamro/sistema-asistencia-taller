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

    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='precios_paquete',
        verbose_name='Ciclo'
    )
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
    cantidad_clases_secundaria = models.IntegerField(
        choices=CANTIDAD_CLASES_CHOICES,
        null=True,
        blank=True,
        verbose_name='Cantidad de Clases Secundaria',
        help_text='Solo para combo_musical y mixto. Ej: combo 12+8 → principal=12, secundaria=8'
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
        ordering = ['ciclo', 'tipo_paquete', 'tipo_taller', 'cantidad_clases']
        unique_together = ['ciclo', 'tipo_taller', 'tipo_paquete', 'cantidad_clases', 'cantidad_clases_secundaria']
        verbose_name = 'Precio de Paquete'
        verbose_name_plural = 'Precios de Paquetes'

    def __str__(self):
        ciclo_nombre = self.ciclo.nombre if self.ciclo else 'Global'
        clases = str(self.cantidad_clases)
        if self.cantidad_clases_secundaria:
            clases = f"{self.cantidad_clases}+{self.cantidad_clases_secundaria}"
        return f"{ciclo_nombre} - {self.get_tipo_paquete_display()} - {self.get_tipo_taller_display()} - {clases} clases: S/. {self.precio_total}"

    @classmethod
    def get_precio_individual(cls, tipo_taller, cantidad_clases, ciclo_id=None):
        """Obtiene precio para un paquete individual. Busca primero por ciclo, luego global."""
        # Try cycle-specific first
        if ciclo_id:
            try:
                precio = cls.objects.get(
                    ciclo_id=ciclo_id,
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
                pass
        
        # Fallback to global (ciclo=None)
        try:
            precio = cls.objects.get(
                ciclo__isnull=True,
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
    def calcular_precio_recomendado(cls, matriculas_data, ciclo_id=None):
        """
        Calcula el precio recomendado basado en las matrículas.
        Detecta automáticamente paquetes promocionales.

        matriculas_data: lista de dicts con 'tipo_taller', 'cantidad_clases'
        ciclo_id: ID del ciclo para buscar precios específicos (opcional)
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
            precio = cls.get_precio_individual(m['tipo_taller'], m['cantidad_clases'], ciclo_id)
            if precio:
                total_bruto += precio['precio_total']

        # Detectar Combo Musical (2 instrumentos)
        if len(instrumentos) >= 2:
            combos = cls._detectar_combo_musical(instrumentos, ciclo_id)
            if combos['aplica']:
                descuento = combos['descuento']
                paquete_detectado = combos['tipo']
                desglose = combos['desglose']

        # Detectar Mixto (1 instrumento + 1 taller)
        elif len(instrumentos) == 1 and len(talleres) == 1:
            mixto = cls._detectar_mixto(instrumentos[0], talleres[0], ciclo_id)
            if mixto['aplica']:
                descuento = mixto['descuento']
                paquete_detectado = mixto['tipo']
                desglose = mixto['desglose']

        # Detectar Intensivo (20 clases)
        elif any(m['cantidad_clases'] == 20 for m in matriculas_data):
            intensivo = cls._detectar_intensivo(matriculas_data, ciclo_id)
            if intensivo['aplica']:
                descuento = intensivo['descuento']
                paquete_detectado = intensivo['tipo']
                desglose = intensivo['desglose']

        # Si no hay promoción, usar precios individuales
        if not desglose:
            for m in matriculas_data:
                precio = cls.get_precio_individual(m['tipo_taller'], m['cantidad_clases'], ciclo_id)
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
    def _detectar_combo_musical(cls, instrumentos, ciclo_id=None):
        """Detecta combo musical (2 instrumentos) usando cantidad_clases_secundaria"""
        inst_ordenados = sorted(instrumentos, key=lambda x: x['cantidad_clases'], reverse=True)
        inst1 = inst_ordenados[0]
        inst2 = inst_ordenados[1] if len(inst_ordenados) >= 2 else inst_ordenados[0]
        primaria = inst1['cantidad_clases']
        secundaria = inst2['cantidad_clases']

        def _buscar_combo(cid):
            filtro = {
                'tipo_paquete': 'combo_musical',
                'cantidad_clases': primaria,
                'cantidad_clases_secundaria': secundaria,
                'activo': True,
            }
            if cid:
                return cls.objects.get(ciclo_id=cid, **filtro)
            return cls.objects.get(ciclo__isnull=True, **filtro)

        try:
            combo = _buscar_combo(ciclo_id)
        except cls.DoesNotExist:
            try:
                combo = _buscar_combo(None)
            except cls.DoesNotExist:
                return {'aplica': False, 'descuento': 0, 'desglose': []}

        precio_individual = (
            cls.get_precio_individual('instrumento', primaria, ciclo_id)['precio_total'] +
            cls.get_precio_individual('instrumento', secundaria, ciclo_id)['precio_total']
        )
        descuento = precio_individual - float(combo.precio_total)
        mitad = float(combo.precio_total) / 2
        return {
            'aplica': True,
            'tipo': f'combo_musical_{primaria}_{secundaria}',
            'descuento': descuento,
            'desglose': [
                {'tipo_taller': 'instrumento', 'cantidad_clases': primaria, 'precio': mitad},
                {'tipo_taller': 'instrumento', 'cantidad_clases': secundaria, 'precio': mitad}
            ]
        }

    @classmethod
    def _detectar_mixto(cls, instrumento, taller, ciclo_id=None):
        """Detecta mixto (instrumento + taller) usando cantidad_clases_secundaria"""
        primaria = max(instrumento['cantidad_clases'], taller['cantidad_clases'])
        secundaria = min(instrumento['cantidad_clases'], taller['cantidad_clases'])

        def _buscar_mixto(cid):
            filtro = {
                'tipo_paquete': 'mixto',
                'cantidad_clases': primaria,
                'cantidad_clases_secundaria': secundaria,
                'activo': True,
            }
            if cid:
                return cls.objects.get(ciclo_id=cid, **filtro)
            return cls.objects.get(ciclo__isnull=True, **filtro)

        try:
            mixto = _buscar_mixto(ciclo_id)
        except cls.DoesNotExist:
            try:
                mixto = _buscar_mixto(None)
            except cls.DoesNotExist:
                return {'aplica': False, 'descuento': 0, 'desglose': []}

        precio_individual = (
            cls.get_precio_individual('instrumento', instrumento['cantidad_clases'], ciclo_id)['precio_total'] +
            cls.get_precio_individual('taller', taller['cantidad_clases'], ciclo_id)['precio_total']
        )
        descuento = precio_individual - float(mixto.precio_total)
        return {
            'aplica': True,
            'tipo': f'mixto_{primaria}_{secundaria}',
            'descuento': descuento,
            'desglose': [
                {'tipo_taller': 'instrumento', 'cantidad_clases': instrumento['cantidad_clases'], 'precio': float(mixto.precio_total) / 2},
                {'tipo_taller': 'taller', 'cantidad_clases': taller['cantidad_clases'], 'precio': float(mixto.precio_total) / 2}
            ]
        }

    @classmethod
    def _detectar_intensivo(cls, matriculas_data, ciclo_id=None):
        """Detecta paquete intensivo (20 clases)"""
        for m in matriculas_data:
            if m['cantidad_clases'] == 20:
                try:
                    if ciclo_id:
                        intensivo = cls.objects.get(
                            ciclo_id=ciclo_id,
                            tipo_paquete='intensivo',
                            tipo_taller=m['tipo_taller'],
                            cantidad_clases=20,
                            activo=True
                        )
                    else:
                        intensivo = cls.objects.get(
                            ciclo__isnull=True,
                            tipo_paquete='intensivo',
                            tipo_taller=m['tipo_taller'],
                            cantidad_clases=20,
                            activo=True
                        )
                    precio_individual = cls.get_precio_individual(m['tipo_taller'], 20, ciclo_id)
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
