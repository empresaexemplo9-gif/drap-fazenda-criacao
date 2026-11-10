import {
  Beef, Milk, Dna, Sprout, Package, Scale, LineChart, ListChecks, Syringe, CalendarDays, Settings, FileText, Users,
  Tractor, Calculator, ClipboardList, Wallet, Sheet, type LucideIcon,
} from 'lucide-react';

/** Ícone de cada rota, usado no menu lateral e nos atalhos do painel. */
export const ICONES: Record<string, LucideIcon> = {
  '/rebanho/': Beef, '/manejo/': Scale, '/pastagens/': Sprout, '/sanidade/': Syringe, '/agenda/': CalendarDays,
  '/lancamentos/': ListChecks, '/posicao/': Wallet, '/custos/': Calculator, '/estoque/': Package, '/documentos/': FileText,
  '/equipe/': Users, '/mercado/': LineChart, '/corte/': Tractor, '/leite/': Milk, '/genetica/': Dna, '/feira/': ClipboardList,
  '/planilha/': Sheet, '/config/': Settings,
};
