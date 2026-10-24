import { serve } from '../_shared/runtime.ts';
import { createUser } from './handler.ts';

serve(createUser, 'crm-create-user');
