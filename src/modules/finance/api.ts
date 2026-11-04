import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FinanceAudit, FinanceInstallment, FinanceMethod, FinanceMovement,
  FinancePaymentKind, FinanceSale, FinanceScheduleRow,
} from './model';

export interface FinanceRecords {
  sales: FinanceSale[];
  installments: FinanceInstallment[];
  movements: FinanceMovement[];
  audit: FinanceAudit[];
}
export function financeError(error: { message?: string; code?: string } | null): Error {
  const message = error?.message || '';
  const known: Record<string,string> = {
    CRM_FORBIDDEN: 'Seu perfil não tem permissão para essa operação financeira.',
    CRM_FINANCE_NOT_FOUND: 'Registro financeiro não encontrado para a empresa.',
    CRM_FINANCE_ALREADY_HAS_MOVEMENTS: 'Essa venda já possui movimentações. Para corrigir, use estorno ou anulação com histórico.',
    CRM_FINANCE_OVERPAYMENT: 'O valor informado ultrapassa o saldo disponível da parcela.',
    CRM_FINANCE_SCHEDULE_SUM_MISMATCH: 'A soma das parcelas não corresponde ao valor total da venda.',
    CRM_FINANCE_INVALID_SCHEDULE: 'Confira as parcelas e os vencimentos informados.',
    CRM_FINANCE_REFUND_TOO_HIGH: 'O estorno ultrapassa o valor ainda disponível.',
    CRM_FINANCE_REFUND_BEFORE_REOPEN: 'Existe pagamento recebido. Faça o estorno antes de reabrir a venda.',
    CRM_STALE_VERSION: 'O lançamento foi alterado. Atualize os dados e tente novamente.',
  };
  const key = Object.keys(known).find(x=>message.includes(x));
  return new Error(key?known[key]:'Não foi possível concluir a operação financeira. Confira os dados e tente novamente.');
}
/** O banco filtra empresa, carteira e ações por RLS; o frontend não substitui essa autorização. */
export class FinanceRepository {
  constructor(private client: SupabaseClient, private companyId: string) {}
  private async all<T>(table: string, order: string): Promise<T[]> {
    const rows: T[] = [];
    for(let start=0; start<10000; start+=200) {
      const result = await this.client.from(table).select('*').eq('company_id',this.companyId)
        .order(order,{ascending:false}).order('id',{ascending:false}).range(start,start+199);
      if(result.error || !result.data) throw financeError(result.error);
      rows.push(...result.data as T[]);
      if(result.data.length<200) return rows;
    }
    throw Error('Há muitos lançamentos para uma única consulta. Utilize um período menor.');
  }
  async load(): Promise<FinanceRecords> {
    const [saleResult,instResult,movements,audit] = await Promise.all([
      this.client.from('crm_finance_sales').select('*').eq('company_id',this.companyId)
        .order('confirmed_at',{ascending:false}).limit(10000),
      this.client.from('crm_finance_installments').select('*').eq('company_id',this.companyId)
        .order('due_on',{ascending:false}).limit(10000),
      this.all<FinanceMovement>('crm_finance_movements','posted_on'),
      this.all<FinanceAudit>('crm_finance_audit','occurred_at'),
    ]);
    if (saleResult.error || !saleResult.data) throw financeError(saleResult.error);
    if (instResult.error || !instResult.data) throw financeError(instResult.error);
    return {
      sales:saleResult.data as FinanceSale[],
      installments:instResult.data as FinanceInstallment[],
      movements,audit,
    };
  }
  private async write<T>(name:string, args:Record<string,unknown>):Promise<T> {
    let result;
    try { result=await this.client.rpc(name,{p_company:this.companyId,...args}); }
    catch { throw Error('Não foi possível confirmar a gravação. Confira o lançamento antes de repetir.'); }
    if(result.error || !result.data) throw financeError(result.error);
    return result.data as T;
  }
  saveTerms(sale:FinanceSale,kind:FinancePaymentKind,cash:number,term:number,schedule:FinanceScheduleRow[]) {
    return this.write<FinanceSale>('crm_finance_set_terms',{
      p_card:sale.opportunity_id,p_cash:cash,p_term:term,p_kind:kind,
      p_schedule:schedule,p_version:sale.row_version,
    });
  }
  recordReceipt(installment:FinanceInstallment,amount:number,method:FinanceMethod,day:string,description:string,request:string) {
    return this.write<FinanceMovement>('crm_finance_record_receipt',{
      p_installment:installment.id,p_request:request,p_amount:amount,
      p_method:method,p_date:day,p_description:description,
    });
  }
  saveExpense({
    id, amount,method,day,category,description,owner,opportunity,version,
  }:{id:string;amount:number;method:FinanceMethod;day:string;category:string;
     description:string;owner:string;opportunity:string|null;version?:number}) {
    return this.write<FinanceMovement>('crm_finance_save_expense',{
      p_id:id,p_amount:amount,p_method:method,p_date:day,
      p_category:category,p_description:description,p_owner:owner,
      p_opportunity:opportunity,p_version:version??null,
    });
  }
  refund(receipt:FinanceMovement,amount:number,method:FinanceMethod,day:string,reason:string,request:string) {
    return this.write<FinanceMovement>('crm_finance_refund',{
      p_receipt:receipt.id,p_request:request,p_amount:amount,p_date:day,
      p_method:method,p_reason:reason,
    });
  }
  voidMovement(record:FinanceMovement,reason:string) {
    return this.write<FinanceMovement>('crm_finance_void_movement',{
      p_movement:record.id,p_version:record.row_version,p_reason:reason,
    });
  }
}
