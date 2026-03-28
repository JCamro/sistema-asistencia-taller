from django.db import models


class ReciboMatricula(models.Model):
    recibo = models.ForeignKey(
        'Recibo',
        on_delete=models.CASCADE,
        related_name='matriculas'
    )
    matricula = models.ForeignKey(
        'Matricula',
        on_delete=models.CASCADE,
        related_name='recibos'
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['recibo', 'matricula']

    def __str__(self):
        return f"{self.recibo} - {self.matricula} - S/. {self.monto}"
