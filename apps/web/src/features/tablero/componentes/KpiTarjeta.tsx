import clsx from 'clsx';
import { motion } from 'framer-motion';
import { SemaforoChip } from '@/components/ui';
import type { KpiVista } from '../kpis';

const ACENTO: Record<KpiVista['estado'], string> = {
  good: 'before:bg-ok',
  warn: 'before:bg-[#e0a800]',
  crit: 'before:bg-error',
  neu: 'before:bg-transparent',
};

export function KpiTarjeta({ k, indice = 0 }: { k: KpiVista; indice?: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(indice, 12) * 0.03 }}
      data-testid={`kpi-${k.id}`}
      aria-label={k.titulo}
      className={clsx(
        'tarjeta relative flex min-h-[8.5rem] flex-col overflow-hidden p-4 before:absolute before:inset-y-0 before:left-0 before:w-1',
        ACENTO[k.estado],
      )}
    >
      <h3 className="text-sm font-medium leading-tight text-tinta-suave">{k.titulo}</h3>
      <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-tinta sm:text-3xl">
        {k.valor}
        {k.unidad && k.valor !== '–' && (
          <span className="ml-1 text-sm font-semibold text-tinta-tenue sm:text-base">
            {k.unidad}
          </span>
        )}
      </p>
      <div className="mt-auto space-y-1 pt-2">
        <SemaforoChip estado={k.estado} />
        <p className="text-xs leading-snug text-tinta-tenue">{k.detalle}</p>
      </div>
    </motion.article>
  );
}
