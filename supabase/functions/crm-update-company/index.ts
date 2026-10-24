import { serve } from '../_shared/runtime.ts';
import { updateCompany } from './handler.ts';
serve(updateCompany, 'crm-update-company');
