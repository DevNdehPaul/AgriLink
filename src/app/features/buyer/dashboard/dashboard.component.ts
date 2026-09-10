import {Component,inject,ChangeDetectorRef} from '@angular/core';import {CommonModule} from '@angular/common';import {RouterLink} from '@angular/router';import {ApiService} from '../../../core/api.service';import {AuthService} from '../../../core/auth.service';import {Order,ProduceListing,Wallet} from '../../../core/models';
import {finalize} from 'rxjs';
@Component({selector:'app-dashboard',standalone:true,imports:[CommonModule,RouterLink],templateUrl:'./dashboard.component.html',styleUrl:'./dashboard.component.css'})
export class DashboardComponent{cdr=inject(ChangeDetectorRef);
 api=inject(ApiService);auth=inject(AuthService);listings:ProduceListing[]=[];orders:Order[]=[];wallet:Wallet|null=null;
 walletLoading=true;ordersLoading=true;marketLoading=true;
 ngOnInit(){
  // Load each dashboard block independently. A slow wallet/database request no longer blocks the whole page.
  this.api.wallet(8).pipe(finalize(()=>this.cdr.detectChanges())).subscribe({next:r=>{this.wallet=r.data.wallet;this.walletLoading=false},error:()=>this.walletLoading=false});
  this.api.orders(8).pipe(finalize(()=>this.cdr.detectChanges())).subscribe({next:r=>{this.orders=r.data.items;this.ordersLoading=false},error:()=>this.ordersLoading=false});
  this.api.marketplace({limit:4}).pipe(finalize(()=>this.cdr.detectChanges())).subscribe({next:r=>{this.listings=r.data.items;this.marketLoading=false},error:()=>this.marketLoading=false});
 }
 active(){return this.orders.filter(o=>!['COMPLETED','CANCELLED'].includes(o.status)).slice(0,3)} money(v:any){return Number(v||0).toLocaleString()}
}
