from django.db import models


class HoraTrabajada(models.Model):
    TIPO = [
        ('clase_regular', 'Clase Regular'),
        ('asistencia', 'Asistencia'),
        ('hora_extra', 'Hora Extra'),
        ('clase_cancelada', 'Clase Cancelada'),
    ]

    ESTADO = [
        ('pendiente', 'Pendiente'),
        ('aprobada', 'Aprobada'),
        ('rechazada', 'Rechazada'),
    ]

    CREATED_FROM = [
        ('asistencia_auto', 'Asistencia Auto'),
        ('admin_manual', 'Admin Manual'),
    ]

    profesor = models.ForeignKey(
        'Profesor',
        on_delete=models.CASCADE,
        related_name='horas_trabajadas'
    )
    ciclo = models.ForeignKey(
        'Ciclo',
        on_delete=models.CASCADE,
        related_name='horas_trabajadas'
    )
    horario = models.ForeignKey(
        'Horario',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='horas_trabajadas'
    )
    fecha = models.DateField()
    tipo = models.CharField(max_length=20, choices=TIPO, default='clase_regular')
    horas_trabajadas = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADO, default='aprobada')

    # Campos monetarios
    num_alumnos = models.PositiveIntegerField(default=0)
    valor_generado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_base = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_adicional = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    monto_profesor = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    ganancia_taller = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Metadata
    config_snapshot = models.JSONField(null=True, blank=True)
    observacion = models.TextField(blank=True)
    created_from = models.CharField(max_length=20, choices=CREATED_FROM, default='admin_manual')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-fecha']
        constraints = [
            models.UniqueConstraint(
                fields=['profesor', 'horario', 'fecha', 'tipo'],
                condition=models.Q(horario__isnull=False),
                name='uq_hora_trabajada_profesor_horario_fecha_tipo'
            ),
        ]
        indexes = [
            models.Index(fields=['fecha'], name='ht_fecha_idx'),
            models.Index(fields=['profesor', 'fecha'], name='ht_profesor_fecha_idx'),
            models.Index(
                fields=['ciclo', 'profesor', 'estado', 'fecha'],
                name='ht_ciclo_prof_estado_fecha_idx'
            ),
        ]

    def __str__(self):
        return f"{self.profesor} - {self.fecha} ({self.get_tipo_display()}) - {self.get_estado_display()}"
