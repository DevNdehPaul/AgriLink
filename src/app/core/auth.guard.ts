import { inject } from '@angular/core'; import { CanActivateFn, Router } from '@angular/router';
function roleGuard(role:string):CanActivateFn{return ()=>{const token=localStorage.getItem('agri_access');const raw=localStorage.getItem('agri_user');let current='';try{current=JSON.parse(raw||'{}').role||''}catch{};return token&&current===role?true:inject(Router).createUrlTree(['/login']);};}
export const buyerGuard=roleGuard('BUYER');
export const cooperativeGuard=roleGuard('COOPERATIVE');

export const driverGuard=roleGuard('DRIVER');

export const adminGuard=roleGuard('ADMIN');
