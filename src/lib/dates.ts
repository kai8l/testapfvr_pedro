const p = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
export const fromISO = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const br = (s?: string | null) => (s ? s.split('-').reverse().join('/') : '');
export const hhmm = (d: Date) => `${p(d.getHours())}:${p(d.getMinutes())}`;
export const money = (n: number) => {
  const [i, d] = Math.abs(n || 0).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}R$ ${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`;
};
export const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
export const WD = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
export const WD_LONG = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
export const startOfWeek = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
