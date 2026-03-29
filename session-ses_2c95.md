
## User

PAQUETES Y PRECIO POR SESIÓN
Instrumento:

Paquete de 12 clases → S/. 200 total / S/. 16.67 por sesión
Paquete de 8 clases → S/. 160 total / S/. 20.00 por sesión
Clase suelta → S/. 20.00

Taller:

Paquete de 12 clases → S/. 180 total / S/. 15.00 por sesión
Paquete de 8 clases → S/. 140 total / S/. 17.50 por sesión
Clase suelta → S/. 20.00

Paquetes promocionales:
Combo Musical (dos instrumentos):

12 clases cada instrumento → S/. 360 / S/. 15.00 por sesión por instrumento
8 clases cada instrumento → S/. 290 / S/. 18.13 por sesión por instrumento
Combinado 12+8 → S/. 330

Mixto (instrumento + taller):

12 clases cada uno → S/. 340 / S/. 15.00 por sesión (instrumento) / S/. 13.30 (taller)
8 clases cada uno → S/. 270 / S/. 18.13 por sesión (instrumento) / S/. 15.63 (taller)
Combinado 12+8 → S/. 310

Intensivo:

20 clases instrumento → S/. 300 / S/. 15.00 por sesión
20 clases taller → S/. 250 / S/. 12.50 por sesión


TIPOS DE ALUMNOS RECURRENTES

Paquete de 12 clases (la mayoría)
Paquete de 8 clases
Clase suelta (muy pocos) aqui tienes el contexto de las promociones, pero tambien quiero incluir una opcion para editar el precio en caso quiera poner un poco menos, los descuentos puedes computarlos, analiza y razona esta logica, y deberia poder recomendar un precio pero a la vez yo puedo editar ese precio, en los recibos usualmente en esta spromociones se suelen poner las matriculas de los alumnos que estan adquiriendo y computar cuanto precio de ese costo corresponderia a cada instrumento o taller, hay INSTRUMENTO y TALLER, al momento de crear un taller se debera especificar si es INSTRUMENTO o TALLER, ejemplos TALLER: DibujoPinturaCeramica, Canto; INSTRUMENTO: Guitarra, Organo pero como te digo seria bueno computar un precio recomendado al momento de crear el recibo y matricula pero el usuario puede cambiarlo

---

## Assistant (Plan · mimo-v2-omni-free · 28.4s)

_Thinking:_

El usuario me está dando información muy detallada sobre los paquetes y precios. Necesito analizar esto y crear un plan detallado para implementar el sistema de precios con:

1. Tipos de taller: INSTRUMENTO vs TALLER
2. Paquetes por tipo de clase
3. Paquetes promocionales combinados
4. Recomendación de precio pero permitir edición
5. Múltiples matrículas en un solo recibo

Voy a analizar toda la información y crear un plan completo.

Perfecto. Tengo toda la información necesaria. Voy a analizar y crear el plan completo.

---

## Plan: Sistema de Precios y Recibos con Paquetes Promocionales

### 1. NUEVO CAMPO EN TALLER: Tipo

**Modelo `core/models/taller.py`** - Agregar:
```python
TIPO_CHOICES = [
    ('instrumento', 'Instrumento'),
    ('taller', 'Taller'),
]

tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='taller')
```

### 2. TABLA DE PRECIOS BASE

#### Instrumento:
| Paquete | Total | Por sesión |
|---------|-------|------------|
| 12 clases | S/. 200 | S/. 16.67 |
| 8 clases | S/. 160 | S/. 20.00 |
| Suelta | S/. 20 | S/. 20.00 |

#### Taller:
| Paquete | Total | Por sesión |
|---------|-------|------------|
| 12 clases | S/. 180 | S/. 15.00 |
| 8 clases | S/. 140 | S/. 17.50 |
| Suelta | S/. 20 | S/. 20.00 |

### 3. PAQUETES PROMOCIONALES

#### Combo Musical (2 instrumentos):
| Tipo | Total | Por sesión/inst |
|------|-------|-----------------|
| 12+12 | S/. 360 | S/. 15.00 |
| 8+8 | S/. 290 | S/. 18.13 |
| 12+8 | S/. 330 | S/. 15.00 / S/. 18.13 |

#### Mixto (instrumento + taller):
| Tipo | Total | Por sesión |
|------|-------|------------|
| 12+12 | S/. 340 | S/. 15.00 / S/. 13.30 |
| 8+8 | S/. 270 | S/. 18.13 / S/. 15.63 |
| 12+8 | S/. 310 | S/. 15.00 / S/. 17.50 |

#### Intensivo:
| Tipo | Total | Por sesión |
|------|-------|------------|
| 20 inst | S/. 300 | S/. 15.00 |
| 20 taller | S/. 250 | S/. 12.50 |

### 4. MODELO DE PRECIOS PROPUESTO

```python
# core/models/precio_paquete.py

class PrecioPaquete(models.Model):
    TIPO_TALLER = [
        ('instrumento', 'Instrumento'),
        ('taller', 'Taller'),
    ]
    TIPO_PAQUETE = [
        ('individual', 'Individual'),
        ('combo_musical', 'Combo Musical'),
        ('mixto', 'Mixto (Instrumento + Taller)'),
        ('intensivo', 'Intensivo'),
    ]
    CLASES = [
        (1, 'Clase suelta'),
        (8, 'Paquete 8 clases'),
        (12, 'Paquete 12 clases'),
        (20, 'Paquete 20 clases'),
    ]

    tipo_taller = models.CharField(max_length=20, choices=TIPO_TALLER)
    tipo_paquete = models.CharField(max_length=20, choices=TIPO_PAQUETE)
    cantidad_clases = models.IntegerField(choices=CLASES)
    precio_total = models.DecimalField(max_digits=10, decimal_places=2)
    precio_por_sesion = models.DecimalField(max_digits=10, decimal_places=2)
    activo = models.BooleanField(default=True)

    class Meta:
        unique_together = ['tipo_taller', 'tipo_paquete', 'cantidad_clases']
```

### 5. CAMBIOS EN MODELO TALLER

```python
# core/models/taller.py - Agregar campo tipo

class Taller(models.Model):
    TIPO_CHOICES = [
        ('instrumento', 'Instrumento'),
        ('taller', 'Taller'),
    ]
    
    # ... campos existentes ...
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='taller', verbose_name='Tipo')
```

### 6. LÓGICA DE CÁLCULO EN RECIBO

```python
# core/serializers/recibo.py

class ReciboSerializer(serializers.ModelSerializer):
    precio_recomendado = serializers.SerializerMethodField()
    precio_editable = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)

    def get_precio_recomendado(self, obj):
        """Calcula precio recomendado basado en matrículas"""
        total = 0
        for matricula in obj.matriculas.all():
            total += matricula.precio_total
        return total

    def create(self, validated_data):
        # Si precio_editado no se envía, usar precio_recomendado
        if 'precio_editable' not in validated_data or not validated_data.get('precio_editable'):
            validated_data['monto_total'] = validated_data.get('precio_recomendado', 0)
        else:
            validated_data['monto_total'] = validated_data['precio_editable']
        
        # ... resto de lógica
```

### 7. FLUJO DE CREACIÓN DE RECIBO

```
┌──────────────────────────────────────────────────────────────────┐
│                    FLUJO DE RECIBO                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ADMIN selecciona matrículas para incluir en recibo          │
│              ↓                                                   │
│  2. SISTEMA detecta paquetes promocionales                       │
│     - ¿2+ alumnos? → Combo Musical/Mixto                        │
│     - ¿Mismo alumno tiene 2+ instrumentos? → Combo              │
│              ↓                                                   │
│  3. SISTEMA calcula precio recomendado                          │
│     - Suma total de precios de matrículas                       │
│     - Aplica descuentos automáticos                             │
│              ↓                                                   │
│  4. ADMIN puede EDITAR precio final                             │
│     - Campo editable con precio sugerido                        │
│              ↓                                                   │
│  5. RECIBO se genera con:                                       │
│     - monto_total = precio final (editable o sugerido)          │
│     - descuento = total_bruto - monto_total                     │
│     - motivo_descuento = "Combo Musical" etc                    │
│     - estado = 'pendiente'                                      │
│              ↓                                                   │
│  6. RECIBO se vincula con matrículas (ReciboMatricula)          │
│     - Cada matrícula tiene su monto proporcional                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 8. NUEVA INTERFAZ DE RECIBOS

**Campos en el formulario:**
```
┌─────────────────────────────────────────────┐
│         NUEVO RECIBO                        │
├─────────────────────────────────────────────┤
│ Alumno: [ Juan Pérez               ]        │
│ Ciclo: [ Ciclo Anual 2026          ]        │
│                                             │
│ Matrículas a incluir:                       │
│ ☑ Guitarra 12 clases    - S/. 200          │
│ ☑ Taller Pintura 8 clases - S/. 140        │
│                                             │
│ ─────────────────────────────────────────   │
│ Precio bruto:           S/. 340.00          │
│ Paquete detectado:      Mixto (12+8)        │
│ Descuento automático:   -S/. 30.00          │
│ ─────────────────────────────────────────   │
│ Precio sugerido:        S/. 310.00          │
│ Precio final (editable): [ S/. 310.00 ]  ← │
│ ─────────────────────────────────────────   │
│ Total:                  S/. 310.00          │
│                                             │
│ [Generar Recibo]                            │
└─────────────────────────────────────────────┘
```

### 9. RESUMEN DE CAMBIOS

| Archivo | Acción |
|---------|--------|
| `core/models/taller.py` | Agregar campo `tipo` |
| `core/models/precio_paquete.py` | NUEVO - Tabla de precios |
| `core/models/recibo.py` | Agregar `descuento`, `motivo_descuento`, `precio_recomendado` |
| `core/models/recibo_matricula.py` | Sin cambios |
| `core/serializers/recibo.py` | Lógica de cálculo de precio sugerido |
| `core/views/recibo_view.py` | Endpoint para calcular precio recomendado |
| `frontend/src/pages/Talleres.tsx` | Agregar select de tipo |
| `frontend/src/pages/Recibos.tsx` | Nueva UI con precio sugerido/editable |

### 10. NUEVO ENDPOINT

```python
# GET /api/recibos/calcular-precio/?alumno_ids=1,2&matricula_ids=5,6,7

{
  "precio_bruto": 340.00,
  "paquete_detectado": "mixto_12_8",
  "precio_paquete": 310.00,
  "descuento": 30.00,
  "precio_sugerido": 310.00,
  "desglose": [
    {"matricula_id": 5, "taller": "Guitarra", "clases": 12, "precio": 155.00},
    {"matricula_id": 6, "taller": "Pintura", "clases": 8, "precio": 155.00}
  ]
}
```

---

### PREGUNTAS:

1. **¿El precio editable puede ser menor al sugerido?** (¿límite mínimo?)
2. **¿Los descuentos se aplican automático o el admin elige aplicarlos?**
3. **¿Quieres que al crear matrícula se genere recibo automáticamente, o solo manualmente?**

¿Procedo con la implementación?[e~[

---

## User

1. Si puede ser menor, no limite

---

## Assistant (Plan · mimo-v2-omni-free · 18.7s)

---

