import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { RequestDetailComponent } from './request-detail.component';
import { RequestsService } from '../../../core/services/requests.service';
import { MessagesService } from '../../../core/services/messages.service';
import { AttachmentsService } from '../../../core/services/attachments.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Message, SupportRequest, User } from '../../../core/models';

const customer: User = { id: 'c1', email: 'alice@example.com', name: 'Alice Johnson', role: 'customer' };
const sarah: User = { id: 'a1', email: 'agent1@support.com', name: 'Sarah Chen', role: 'agent' };
const james: User = { id: 'a2', email: 'agent2@support.com', name: 'James Wright', role: 'agent' };

function requestAssignedTo(agentId: string | null, status: SupportRequest['status'] = 'in_progress'): SupportRequest {
  return {
    id: 'r1', reference: 'REQ-000101', title: 'Cannot access my billing history', description: 'Billing page shows an error for a week',
    category: 'billing', priority: 'high', status, customerId: 'c1', assignedAgentId: agentId,
    createdAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-02T09:00:00Z', resolvedAt: null,
  };
}

const savedReply: Message = {
  id: 'm-saved', requestId: 'r1', authorId: 'a1', authorName: 'Sarah Chen', authorRole: 'agent',
  content: 'Customer-facing update', isInternal: false, createdAt: '2026-10-02T10:00:00Z',
};

describe('RequestDetailComponent (internal notes and posting rules)', () => {
  let requests: jasmine.SpyObj<RequestsService>;
  let messages: jasmine.SpyObj<MessagesService>;
  let attachments: jasmine.SpyObj<AttachmentsService>;
  let auth: { currentUser: User | null; getStaff: jasmine.Spy; getUser: jasmine.Spy };

  function create(current: User, request: SupportRequest): ComponentFixture<RequestDetailComponent> {
    auth.currentUser = current;
    requests.getOne.and.returnValue(of(request));
    messages.getForRequest.and.returnValue(of([]));
    messages.sendMessage.and.returnValue(of(savedReply));
    attachments.list.and.returnValue(of([]));

    const fixture = TestBed.createComponent(RequestDetailComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    requests = jasmine.createSpyObj<RequestsService>('RequestsService', ['getOne', 'claim', 'assign', 'updateStatus']);
    messages = jasmine.createSpyObj<MessagesService>('MessagesService', ['getForRequest', 'sendMessage']);
    attachments = jasmine.createSpyObj<AttachmentsService>('AttachmentsService', ['list', 'upload', 'download']);
    auth = {
      currentUser: null,
      getStaff: jasmine.createSpy('getStaff').and.returnValue(of([sarah, james])),
      getUser: jasmine.createSpy('getUser').and.returnValue(of(customer)),
    };

    TestBed.configureTestingModule({
      imports: [RequestDetailComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'r1' }) } } },
        { provide: RequestsService, useValue: requests },
        { provide: MessagesService, useValue: messages },
        { provide: AttachmentsService, useValue: attachments },
        { provide: AuthService, useValue: auth },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('never sends text typed in the internal-note box as a customer reply', () => {
    const fixture = create(sarah, requestAssignedTo('a1'));
    const component = fixture.componentInstance;

    component.noteControl.setValue('Internal: billing migration locked the table');
    component.sendReply();

    expect(messages.sendMessage).not.toHaveBeenCalled();
    expect(component.noteControl.value).toBe('Internal: billing migration locked the table');
  });

  it('sends a reply as customer-visible and keeps an unsent note in its own box', () => {
    const fixture = create(sarah, requestAssignedTo('a1'));
    const component = fixture.componentInstance;

    component.noteControl.setValue('Internal: keep this private');
    component.replyControl.setValue('Customer-facing update');
    component.sendReply();

    expect(messages.sendMessage).toHaveBeenCalledOnceWith('r1', 'Customer-facing update', false);
    expect(component.replyControl.value).toBe('');
    expect(component.noteControl.value).toBe('Internal: keep this private');
  });

  it('sends an internal note with isInternal set, never from the reply box', () => {
    const fixture = create(sarah, requestAssignedTo('a1'));
    const component = fixture.componentInstance;

    component.replyControl.setValue('Public text that must stay in the reply box');
    component.noteControl.setValue('Internal only');
    component.sendNote();

    expect(messages.sendMessage).toHaveBeenCalledOnceWith('r1', 'Internal only', true);
  });

  it('does not let an agent post on a request assigned to someone else', () => {
    const fixture = create(james, requestAssignedTo('a1'));
    const component = fixture.componentInstance;

    expect(component.canPost).toBeFalse();
    component.replyControl.setValue('Trying to reply on another agent request');
    component.sendReply();
    component.noteControl.setValue('Trying to add a note');
    component.sendNote();
    expect(messages.sendMessage).not.toHaveBeenCalled();
  });

  it('lets a manager post on any active request', () => {
    const manager: User = { id: 'm1', email: 'manager@support.com', name: 'Maria', role: 'manager' };
    const fixture = create(manager, requestAssignedTo('a1'));
    expect(fixture.componentInstance.canPost).toBeTrue();
  });

  it('asks a signed-in agent to take an unassigned request before replying', () => {
    const fixture = create(sarah, requestAssignedTo(null, 'open'));
    const component = fixture.componentInstance;

    expect(component.canPost).toBeFalse();
    expect(component.canClaim).toBeTrue();
    expect(component.postingHint).toMatch(/take this request/i);
  });

  it('does not allow posting on a closed request', () => {
    const fixture = create(sarah, requestAssignedTo('a1', 'closed'));
    const component = fixture.componentInstance;

    expect(component.canPost).toBeFalse();
    expect(component.inactiveNotice).toMatch(/closed/i);
    component.replyControl.setValue('Too late to reply');
    component.sendReply();
    expect(messages.sendMessage).not.toHaveBeenCalled();
  });

  it('offers closing only for a resolved request', () => {
    const resolved = create(sarah, requestAssignedTo('a1', 'resolved'));
    expect(resolved.componentInstance.canClose).toBeTrue();
    expect(resolved.componentInstance.availableTransitions.map((t) => t.value)).not.toContain('closed');
  });
});
