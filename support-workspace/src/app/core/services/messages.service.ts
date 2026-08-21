import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Message } from '../models';

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = 'https://iaukydzbcdmglqajllei.supabase.co';
    const supabaseKey = 'sb_publishable_AqWrf6GufnWU-Esd3MkLvQ_xoGFCUlL';
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private mapToModel(data: any): Message {
    return {
      ...data,
      requestId: data.request_id,
      authorId: data.author_id,
      authorName: data.author_name,
      authorRole: data.author_role,
      isInternal: data.is_internal,
      createdAt: data.created_at,
    };
  }

  getForRequest(requestId: string): Observable<Message[]> {
    return from(
      (async () => {
        const { data, error } = await this.supabase
          .from('messages')
          .select('*')
          .eq('request_id', requestId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        return data.map((item) => this.mapToModel(item));
      })()
    );
  }

  sendMessage(
    requestId: string,
    content: string,
    authorId: string,
    authorName: string,
    authorRole: 'agent' | 'manager',
    isInternal: boolean
  ): Observable<Message> {
    return from(
      (async () => {
        const insertData = {
          request_id: requestId,
          author_id: authorId,
          author_name: authorName,
          author_role: authorRole,
          content,
          is_internal: isInternal,
          created_at: new Date().toISOString(),
        };

        const { data, error } = await this.supabase
          .from('messages')
          .insert([insertData])
          .select()
          .single();

        if (error) throw error;
        return this.mapToModel(data);
      })()
    );
  }
}