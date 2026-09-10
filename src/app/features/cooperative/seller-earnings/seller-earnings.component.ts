import {Component,inject,ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {finalize} from 'rxjs';
import {ApiService} from '../../../core/api.service';
import {AuthService} from '../../../core/auth.service';

@Component({selector:'app-seller-earnings',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./seller-earnings.component.html',styleUrl:'./seller-earnings.component.css'})
export class SellerEarningsComponent{
  api=inject(ApiService);auth=inject(AuthService);cdr=inject(ChangeDetectorRef);
  wallet:any=null;entries:any[]=[];withdrawals:any[]=[];loading=true;
  withdrawOpen=false;submitting=false;result:any=null;error='';
  amount:number|null=null;phone='';medium:'mobile money'|'orange money'='mobile money';
  ngOnInit(){
    this.phone=this.auth.user()?.phone||'';
    let n=2;const done=()=>{if(--n===0){this.loading=false;this.cdr.detectChanges()}};
    this.api.wallet(50).pipe(finalize(done)).subscribe({next:r=>{this.wallet=r.data.wallet;this.entries=r.data.entries},error:()=>{}});
    this.api.withdrawals(20).pipe(finalize(done)).subscribe({next:r=>this.withdrawals=r.data.items||[],error:()=>{}})
  }
  withdrawn(){return this.withdrawals.filter(x=>x.status==='SUCCESSFUL').reduce((s,x)=>s+Number(x.amount),0)}
  openWithdraw(){this.error='';this.result=null;this.amount=null;this.phone=this.auth.user()?.phone||this.phone;this.withdrawOpen=true}
  closeWithdraw(){if(!this.submitting)this.withdrawOpen=false}
  useMaximum(){this.amount=Number(this.wallet?.availableBalance||0)}
  submitWithdraw(){
    if(!this.amount||this.amount<=0){this.error='Enter a valid withdrawal amount.';return}
    if(this.amount>Number(this.wallet?.availableBalance||0)){this.error='Amount is higher than your available balance.';return}
    if(!this.phone.trim()){this.error='Enter the mobile money phone number.';return}
    this.submitting=true;this.error='';
    this.api.withdraw(this.amount,this.phone.trim(),this.medium).pipe(finalize(()=>{this.submitting=false;this.cdr.detectChanges()})).subscribe({
      next:r=>{this.result=r.data.withdrawal;this.api.wallet(50).subscribe({next:w=>{this.wallet=w.data.wallet;this.entries=w.data.entries;this.cdr.detectChanges()}})},
      error:e=>this.error=e.error?.message||'Withdrawal could not be submitted.'
    })
  }
  sync(){if(!this.result)return;this.submitting=true;this.api.syncWithdrawal(this.result.id).pipe(finalize(()=>{this.submitting=false;this.cdr.detectChanges()})).subscribe({next:r=>this.result=r.data.withdrawal,error:e=>this.error=e.error?.message||'Could not check payout status.'})}
}
