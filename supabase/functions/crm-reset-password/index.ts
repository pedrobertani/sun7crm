import { serve } from '../_shared/runtime.ts';
import { resetPassword } from './handler.ts';

serve(resetPassword, 'crm-reset-password');
