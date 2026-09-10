import {Component,inject,ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ApiService} from '../../../core/api.service';
import {Deposit,LedgerEntry,Wallet} from '../../../core/models';
import {finalize} from 'rxjs';
@Component({selector:'app-wallet',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./wallet.component.html',styleUrl:'./wallet.component.css'})
export class WalletComponent{
 private cdr=inject(ChangeDetectorRef);private api=inject(ApiService);
 wallet:Wallet|null=null;entries:LedgerEntry[]=[];deposits:Deposit[]=[];loading=true;depositsLoading=true;error='';filter='ALL';page=1;pageSize=5;
 addOpen=false;amount=20000;phone='';medium:'mobile money'|'orange money'='mobile money';deposit:Deposit|null=null;busy=false;addError='';
 ngOnInit(){this.load()}
 load(){this.loading=true;this.error='';this.api.wallet(50).pipe(finalize(()=>this.cdr.detectChanges())).subscribe({next:r=>{this.wallet=r.data.wallet;this.entries=r.data.entries||[];this.loading=false;this.ensurePage()},error:e=>{this.error=e.error?.message||'Unable to load wallet';this.loading=false}});this.depositsLoading=true;this.api.deposits(10).pipe(finalize(()=>this.cdr.detectChanges())).subscribe({next:r=>{this.deposits=(r.data.items||r.data.deposits||[]);this.depositsLoading=false},error:()=>this.depositsLoading=false})}
 visibleEntries(){return this.filter==='ALL'?this.entries:this.entries.filter(e=>e.type===this.filter)}
 pagedEntries(){const s=(this.page-1)*this.pageSize;return this.visibleEntries().slice(s,s+this.pageSize)}
 pages(){return Array.from({length:Math.max(1,Math.ceil(this.visibleEntries().length/this.pageSize))},(_,i)=>i+1)}
 setPage(p:number){this.page=p}
 ensurePage(){const max=Math.max(1,Math.ceil(this.visibleEntries().length/this.pageSize));if(this.page>max)this.page=max}
 total(){return Number(this.wallet?.availableBalance||0)+Number(this.wallet?.heldBalance||0)}
 sync(d:Deposit){this.api.syncDeposit(d.id).pipe(finalize(()=>this.cdr.detectChanges())).subscribe({next:()=>this.load()})}
 openAdd(){this.addOpen=true;this.deposit=null;this.addError='';this.amount=20000}
 closeAdd(){if(!this.busy)this.addOpen=false}
 submitAdd(){if(!this.amount||this.amount<100||!this.phone.trim())return;this.busy=true;this.addError='';this.api.addMoney(Number(this.amount),this.phone.trim(),this.medium).pipe(finalize(()=>{this.busy=false;this.cdr.detectChanges()})).subscribe({next:r=>this.deposit=r.data.deposit,error:e=>this.addError=e.error?.message||'Unable to start deposit'})}
 syncAdd(){if(!this.deposit)return;this.busy=true;this.api.syncDeposit(this.deposit.id).pipe(finalize(()=>{this.busy=false;this.cdr.detectChanges()})).subscribe({next:r=>{this.deposit=r.data.deposit;if(this.deposit.status==='SUCCESSFUL')this.load()},error:e=>this.addError=e.error?.message||'Unable to check payment status'})}
 money(v:any){return Number(v||0).toLocaleString()}
}
