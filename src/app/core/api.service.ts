import {Injectable,inject} from '@angular/core';
import {HttpClient,HttpParams} from '@angular/common/http';
import {ApiResponse,Order,ProduceListing,Wallet,LedgerEntry,Deposit} from './models';
@Injectable({providedIn:'root'})
export class ApiService{
 private http=inject(HttpClient); readonly base='http://localhost:4000/api/v1';
 marketplace(filters:{name?:string;city?:string;minPrice?:number;maxPrice?:number;sort?:string;limit?:number}={}){let p=new HttpParams().set('limit',String(filters.limit??12));Object.entries(filters).forEach(([k,v])=>{if(v!==undefined&&v!==''&&k!=='limit')p=p.set(k,String(v))});return this.http.get<ApiResponse<{items:ProduceListing[];total:number}>>(`${this.base}/produce`,{params:p})}
 produce(id:string){return this.http.get<ApiResponse<{listing:ProduceListing}>>(`${this.base}/produce/${id}`)}
 orders(limit=20){return this.http.get<ApiResponse<{items:Order[];total:number}>>(`${this.base}/orders?limit=${limit}`)}
 order(id:string){return this.http.get<ApiResponse<{order:Order}>>(`${this.base}/orders/${id}`)}
 createOrder(body:{listingId:string;quantityKg:number;deliveryCity:string;deliveryAddress:string}){return this.http.post<ApiResponse<{order:Order}>>(`${this.base}/orders`,body)}
 payOrder(id:string){return this.http.post<ApiResponse<{order:Order;wallet:Wallet}>>(`${this.base}/orders/${id}/pay`,{})}
 cancelOrder(id:string){return this.http.post<ApiResponse<{order:Order}>>(`${this.base}/orders/${id}/cancel`,{})}
 createShipment(id:string){return this.http.post<ApiResponse<{shipment:any}>>(`${this.base}/shipments/orders/${id}`,{})}
 confirmDelivery(id:string){return this.http.post<ApiResponse<any>>(`${this.base}/orders/${id}/confirm-delivery`,{})}
 openDispute(id:string,reason:string){return this.http.post<ApiResponse<any>>(`${this.base}/disputes/orders/${id}`,{reason})}
 disputes(){return this.http.get<ApiResponse<{disputes:any[]}>>(`${this.base}/disputes/mine`)}
 wallet(limit=20){return this.http.get<ApiResponse<{wallet:Wallet;entries:LedgerEntry[];total:number}>>(`${this.base}/wallet?limit=${limit}`)}
 deposits(limit=10){return this.http.get<ApiResponse<{items:Deposit[];deposits?:Deposit[];total:number}>>(`${this.base}/wallet/deposits?limit=${limit}`)}
 addMoney(amount:number,phone:string,medium?:'mobile money'|'orange money'){return this.http.post<ApiResponse<{deposit:Deposit}>>(`${this.base}/wallet/deposits/direct-pay`,{amount,phone,...(medium?{medium}:{})})}
 syncDeposit(id:string){return this.http.post<ApiResponse<{deposit:Deposit}>>(`${this.base}/wallet/deposits/${id}/sync`,{})}
 withdrawals(limit=20){return this.http.get<ApiResponse<{items:any[];total:number}>>(`${this.base}/wallet/withdrawals?limit=${limit}`)}
 withdraw(amount:number,phone:string,medium:'mobile money'|'orange money'){return this.http.post<ApiResponse<{withdrawal:any}>>(`${this.base}/wallet/withdrawals`,{amount,phone,medium})}
 syncWithdrawal(id:string){return this.http.post<ApiResponse<{withdrawal:any}>>(`${this.base}/wallet/withdrawals/${id}/sync`,{})}
 driverShipments(){return this.http.get<ApiResponse<{shipments:any[]}>>(`${this.base}/shipments/mine`)}
 driverAvailability(isAvailable:boolean){return this.http.patch<ApiResponse<{driver:any}>>(`${this.base}/drivers/me/availability`,{isAvailable})}
 driverVehicles(){return this.http.get<ApiResponse<{vehicles:any[]}>>(`${this.base}/vehicles/mine`)}
 createVehicle(body:{registrationNo:string;type:string;capacityKg:number;currentCity?:string}){return this.http.post<ApiResponse<{vehicle:any}>>(`${this.base}/vehicles`,body)}
 updateVehicleAvailability(id:string,isAvailable:boolean){return this.http.patch<ApiResponse<{vehicle:any}>>(`${this.base}/vehicles/${id}/availability`,{isAvailable})}
 shipmentPickup(id:string,body:{city?:string;note?:string}={}){return this.http.patch<ApiResponse<{shipment:any}>>(`${this.base}/shipments/${id}/pickup`,body)}
 shipmentTransit(id:string,body:{city?:string;note?:string}={}){return this.http.patch<ApiResponse<{shipment:any}>>(`${this.base}/shipments/${id}/in-transit`,body)}
 shipmentDelivery(id:string,body:{city?:string;note?:string}={}){return this.http.patch<ApiResponse<{shipment:any}>>(`${this.base}/shipments/${id}/report-delivery`,body)}
 createProduce(body:any){return this.http.post<ApiResponse<{listing:ProduceListing}>>(`${this.base}/produce`,body)}
 updateProduce(id:string,body:any){return this.http.patch<ApiResponse<{listing:ProduceListing}>>(`${this.base}/produce/${id}`,body)}
 adminDashboard(){return this.http.get<ApiResponse<{dashboard:any}>>(`${this.base}/admin/dashboard`)}
 adminAlerts(){return this.http.get<ApiResponse<{alerts:any}>>(`${this.base}/admin/operations/alerts`)}
 adminOrders(page=1,limit=20,status?:string,search?:string){let p=new HttpParams().set('page',page).set('limit',limit);if(status)p=p.set('status',status);if(search)p=p.set('search',search);return this.http.get<ApiResponse<{orders:any[];pagination:any}>>(`${this.base}/admin/orders`,{params:p})}
 adminOrder(id:string){return this.http.get<ApiResponse<{order:any}>>(`${this.base}/admin/orders/${id}`)}
 adminShipments(page=1,limit=20,status?:string,search?:string){let p=new HttpParams().set('page',page).set('limit',limit);if(status)p=p.set('status',status);if(search)p=p.set('search',search);return this.http.get<ApiResponse<{shipments:any[];pagination:any}>>(`${this.base}/admin/shipments`,{params:p})}
 adminShipment(id:string){return this.http.get<ApiResponse<{shipment:any}>>(`${this.base}/admin/shipments/${id}`)}
 adminCooperatives(page=1,limit=20,verificationStatus?:string,city?:string,search?:string){let p=new HttpParams().set('page',page).set('limit',limit);if(verificationStatus)p=p.set('verificationStatus',verificationStatus);if(city)p=p.set('city',city);if(search)p=p.set('search',search);return this.http.get<ApiResponse<{cooperatives:any[];pagination:any}>>(`${this.base}/admin/cooperatives`,{params:p})}
 adminCooperative(id:string){return this.http.get<ApiResponse<{cooperative:any}>>(`${this.base}/admin/cooperatives/${id}`)}
 adminDrivers(page=1,limit=20,verificationStatus?:string,isAvailable?:boolean,city?:string,search?:string){let p=new HttpParams().set('page',page).set('limit',limit);if(verificationStatus)p=p.set('verificationStatus',verificationStatus);if(isAvailable!==undefined)p=p.set('isAvailable',String(isAvailable));if(city)p=p.set('city',city);if(search)p=p.set('search',search);return this.http.get<ApiResponse<{drivers:any[];pagination:any}>>(`${this.base}/admin/drivers`,{params:p})}
 adminVehicles(page=1,limit=20,status?:string,isAvailable?:boolean,city?:string,search?:string){let p=new HttpParams().set('page',page).set('limit',limit);if(status)p=p.set('status',status);if(isAvailable!==undefined)p=p.set('isAvailable',String(isAvailable));if(city)p=p.set('city',city);if(search)p=p.set('search',search);return this.http.get<ApiResponse<{vehicles:any[];pagination:any}>>(`${this.base}/admin/vehicles`,{params:p})}
 adminDisputes(){return this.http.get<ApiResponse<{disputes:any[]}>>(`${this.base}/disputes`)}
 resolveDispute(id:string,resolution:string,adminNote:string){return this.http.patch<ApiResponse<{dispute:any}>>(`${this.base}/disputes/${id}/resolve`,{resolution,adminNote})}
 dispatchRecommendations(id:string){return this.http.get<ApiResponse<{dispatch:any}>>(`${this.base}/shipments/${id}/dispatch-recommendations`)}
 assignShipment(id:string,vehicleId:string){return this.http.patch<ApiResponse<{shipment:any}>>(`${this.base}/shipments/${id}/assign`,{vehicleId})}
 transportLoads(){return this.http.get<ApiResponse<{loads:any[]}>>(`${this.base}/transport-loads`)}
 transportLoad(id:string){return this.http.get<ApiResponse<{load:any}>>(`${this.base}/transport-loads/${id}`)}
 createTransportLoad(vehicleId:string,shipmentIds:string[]){return this.http.post<ApiResponse<{load:any}>>(`${this.base}/transport-loads`,{vehicleId,shipmentIds})}

}

