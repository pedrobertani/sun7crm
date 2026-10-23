import { serve } from '../_shared/runtime.ts';
import { createCompany } from './handler.ts';

serve(createCompany);
