import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SupportRequest, RequestStatus } from '../models';

export interface RequestFilters {
  status?: RequestStatus | '';
  priority?: string;
  category?: string;
  assignedAgentId?: string;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class RequestsService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = 'https://iaukydzbcdmglqajllei.supabase.co';
    const supabaseKey = 'sb_publishable_AqWrf6GufnWU-Esd3MkLvQ_xoGFCUlL';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private mapToModel(data: any): SupportRequest {
    return {
      ...data,
      customerId: data.customer_id,
      assignedAgentId: data.assigned_agent_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      resolvedAt: data.resolved_at,
    };
  }

  getAll(filters: RequestFilters = {}): Observable<SupportRequest[]> {
    return from(
      (async () => {
        let query = this.supabase.from('requests').select('*');

        if (filters.status) query = query.eq('status', filters.status);
        if (filters.priority) query = query.eq('priority', filters.priority);
        if (filters.category) query = query.eq('category', filters.category);
        if (filters.assignedAgentId) query = query.eq('assigned_agent_id', filters.assignedAgentId);
        if (filters.q) query = query.ilike('title', `%${filters.q}%`);

        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        
        return data.map((item) => this.mapToModel(item));
      })()
    );
  }

  getOne(id: string): Observable<SupportRequest> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('requests')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) throw error;
        return this.mapToModel(data);
      })()
    );
  }

  updateStatus(id: string, status: RequestStatus): Observable<SupportRequest> {
    return from(
      (async () => {
        const patch = {
          status,
          updated_at: new Date().toISOString(),
          resolved_at: status === 'resolved' ? new Date().toISOString() : null,
        };
        
        const { data, error } = await this.supabase
          .from('requests')
          .update(patch)
          .eq('id', id)
          .select()
          .single();
          
        if (error) throw error;
        return this.mapToModel(data);
      })()
    );
  }

  assign(id: string, agentId: string | null): Observable<SupportRequest> {
    return from(
      (async () => {
        const patch = {
          assigned_agent_id: agentId,
          status: agentId ? 'in_progress' : 'open',
          updated_at: new Date().toISOString(),
        };
        
        const { data, error } = await this.supabase
          .from('requests')
          .update(patch)
          .eq('id', id)
          .select()
          .single();
          
        if (error) throw error;
        return this.mapToModel(data);
      })()
    );
  }

  close(id: string): Observable<SupportRequest> {
    return from(
      (async () => {
        const patch = {
          status: 'closed',
          updated_at: new Date().toISOString(),
        };
        
        const { data, error } = await this.supabase
          .from('requests')
          .update(patch)
          .eq('id', id)
          .select()
          .single();
          
        if (error) throw error;
        return this.mapToModel(data);
      })()
    );
  }
}