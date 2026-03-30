import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getCiclos, getRecibos, getResumenCiclo } from '../api/endpoints';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';

export function Dashboard() {
  const { data: ciclosData } = useQuery({
    queryKey: ['ciclos'],
    queryFn: async () => {
      const response = await getCiclos();
      return response.data;
    },
  });

  const cicloActivo = ciclosData?.find((c: any) => c.activo);

  const { data: resumenData } = useQuery({
    queryKey: ['resumen', cicloActivo?.id],
    queryFn: async () => {
      if (!cicloActivo?.id) return null;
      const response = await getResumenCiclo(cicloActivo.id);
      return response.data;
    },
    enabled: !!cicloActivo?.id,
  });

  const { data: recibosData } = useQuery({
    queryKey: ['recibos'],
    queryFn: async () => {
      const response = await getRecibos();
      return response.data;
    },
  });

  const recibosPendientes = recibosData?.filter((r: any) => r.estado === 'pendiente') || [];

  const kpiCards = [
    { label: 'Ingreso Bruto', value: resumenData?.ingreso_bruto || 0, color: '#22C55E' },
    { label: 'Egresos', value: resumenData?.egresos_profesores || 0, color: '#EF4444' },
    { label: 'Ingreso Neto', value: resumenData?.ingreso_neto || 0, color: '#4338CA' },
    { label: '% Local (40%)', value: resumenData?.porcentaje_local_40 || 0, color: '#22C55E' },
  ];

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#111827', marginBottom: '1.5rem' }}>Dashboard</h1>
      
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpiCards.map((kpi, index) => (
          <Card key={index}>
            <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>{kpi.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: kpi.color }}>
              S/. {kpi.value.toFixed(2)}
            </div>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <CardHeader>
          <CardTitle>Resumen del Ciclo {cicloActivo?.nombre || 'Sin ciclo activo'}</CardTitle>
        </CardHeader>
        <div style={{ height: '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={resumenData ? [resumenData] : []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="ciclo" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '8px' }}
                labelStyle={{ color: '#111827', fontWeight: 600 }}
              />
              <Bar dataKey="ingreso_bruto" fill="#22c55e" name="Ingreso Bruto" radius={[4, 4, 0, 0]} />
              <Bar dataKey="egresos_profesores" fill="#ef4444" name="Egresos" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ingreso_neto" fill="#D4AF37" name="Ingreso Neto" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Pending Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Pendientes</CardTitle>
        </CardHeader>
        {recibosPendientes.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' }}>Alumno</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' }}>Monto</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {recibosPendientes.slice(0, 5).map((recibo: any) => (
                  <tr key={recibo.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                    <td style={{ padding: '1rem', color: '#111827' }}>{recibo.alumno_nombre}</td>
                    <td style={{ padding: '1rem', color: '#111827' }}>S/. {recibo.monto_total}</td>
                    <td style={{ padding: '1rem', color: '#DC2626', fontWeight: '600' }}>S/. {Number(recibo.saldo_pendiente).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#6B7280' }}>No hay pagos pendientes</p>
        )}
      </Card>
    </div>
  );
}
