import {Component,inject,ChangeDetectorRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ActivatedRoute,Router,RouterLink} from '@angular/router';
import {finalize} from 'rxjs';
import {ApiService} from '../../../core/api.service';
import {ProduceListing} from '../../../core/models';
import {OrderDraftService} from '../../../core/order-draft.service';
@Component({selector:'app-produce-detail',standalone:true,imports:[CommonModule,FormsModule,RouterLink],templateUrl:'./produce-detail.component.html',styleUrl:'./produce-detail.component.css'})
export class ProduceDetailComponent{
 private cdr=inject(ChangeDetectorRef); private api=inject(ApiService); private route=inject(ActivatedRoute); private router=inject(Router); private draft=inject(OrderDraftService);
 listing:ProduceListing|null=null;quantity=10;deliveryCity='Douala';deliveryAddress='';loading=true;error='';
 ngOnInit(){const id=this.route.snapshot.paramMap.get('id')!;this.api.produce(id).pipe(finalize(()=>this.cdr.detectChanges())).subscribe({next:r=>{this.listing=r.data.listing;this.quantity=Math.min(10,Number(this.listing.availableQuantityKg||10));this.loading=false},error:e=>{this.error=e.error?.message||'Listing unavailable';this.loading=false}})}
 total(){return Number(this.listing?.pricePerKg||0)*Number(this.quantity||0)}
 adjust(by:number){if(!this.listing)return;this.quantity=Math.max(1,Math.min(Number(this.listing.availableQuantityKg),Number(this.quantity||0)+by))}
 continue(){if(!this.listing)return;if(!this.deliveryCity.trim()||!this.deliveryAddress.trim()){this.error='Enter the delivery city and address before continuing.';return}this.draft.set({listing:this.listing,quantityKg:Number(this.quantity),deliveryCity:this.deliveryCity.trim(),deliveryAddress:this.deliveryAddress.trim()});this.router.navigate(['/buyer/cart'])}
 money(v:any){return Number(v||0).toLocaleString()}
}
