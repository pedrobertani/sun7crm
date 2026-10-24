import { serve } from '../_shared/runtime.ts';
import { completeFirstAccess } from './handler.ts';

serve(completeFirstAccess, 'crm-first-access');
