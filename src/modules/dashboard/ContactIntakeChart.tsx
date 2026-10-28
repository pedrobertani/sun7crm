import { useState } from 'react';
import { ChartColumn, ChartPie, ChartLine } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { Panel, Empty } from '../../components/shared';
import { Button } from '../../components/ui/button';
import { ThemeTooltip } from '../../components/ThemeTooltip';
import { CHART_COLORS } from '../../lib/themes';
import { dateLabel } from '../../lib/format';
import './contact-chart.css';

const formats = [
  { value: 'bar', label: 'Barras', icon: ChartColumn },
  { value: 'pie', label: 'Pizza', icon: ChartPie },
  { value: 'line', label: 'Linha', icon: ChartLine },
] as const;

export function ContactIntakeChart({ data }: { data: { day: string; count: number }[] }) {
  const [format, setFormat] = useState<(typeof formats)[number]['value']>('bar');
  const points = data.map((point) => ({ ...point, label: dateLabel(point.day) }));
  const xAxis = (
    <XAxis
      dataKey="day"
      tick={{ fill: 'var(--muted)' }}
      axisLine={{ stroke: 'var(--line)' }}
      tickLine={false}
      tickFormatter={(day) => String(day).slice(5).split('-').reverse().join('/')}
    />
  );
  const yAxis = (
    <YAxis
      allowDecimals={false}
      tick={{ fill: 'var(--muted)' }}
      axisLine={{ stroke: 'var(--line)' }}
      tickLine={false}
    />
  );
  const grid = <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />;
  const tooltip = <ThemeTooltip labelFormatter={(day) => dateLabel(String(day))} />;
  return (
    <Panel
      title="Entrada de contatos"
      description={
        format === 'pie'
          ? 'Participação de cada dia nos cadastros do período'
          : 'Cadastros por dia no período selecionado'
      }
      action={
        <div
          className="chart-format-picker"
          role="group"
          aria-label="Visualização da entrada de contatos"
        >
          {formats.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              size="icon"
              variant="outline"
              aria-label={`Gráfico de ${label.toLocaleLowerCase('pt-BR')}`}
              title={label}
              aria-pressed={format === value}
              onClick={() => setFormat(value)}
            >
              <Icon size={18} aria-hidden="true" />
            </Button>
          ))}
        </div>
      }
    >
      {data.some((point) => point.count > 0) ? (
        <>
          <div className="operational-chart">
            <ResponsiveContainer width="100%" height={260}>
              {format === 'pie' ? (
                <PieChart>
                  <Pie
                    data={points}
                    nameKey="label"
                    dataKey="count"
                    outerRadius={100}
                    stroke="var(--surface)"
                    isAnimationActive={false}
                  >
                    {points.map((point, index) => (
                      <Cell key={point.day} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <ThemeTooltip />
                </PieChart>
              ) : format === 'line' ? (
                <LineChart data={data} margin={{ right: 16, top: 10 }}>
                  {grid}
                  {xAxis}
                  {yAxis}
                  {tooltip}
                  <Line
                    name="Contatos"
                    dataKey="count"
                    type="linear"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    dot={{ fill: 'var(--primary)', r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              ) : (
                <BarChart data={data}>
                  {grid}
                  {xAxis}
                  {yAxis}
                  {tooltip}
                  <Bar
                    name="Contatos"
                    dataKey="count"
                    fill="var(--primary)"
                    radius={[5, 5, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {format === 'pie' && (
            <ul className="contact-chart-legend" aria-label="Contatos por dia">
              {points.map((point, index) => (
                <li key={point.day}>
                  <i
                    style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                    aria-hidden="true"
                  />
                  <span>{point.label}</span>
                  <strong>{point.count}</strong>
                </li>
              ))}
            </ul>
          )}
          <table className="sr-only">
            <caption>Cadastros por dia no período selecionado</caption>
            <thead>
              <tr>
                <th>Dia</th>
                <th>Contatos</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.day}>
                  <th>{point.label}</th>
                  <td>{point.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <Empty title="Sem cadastros no período" description="Os novos contatos aparecerão aqui." />
      )}
    </Panel>
  );
}
