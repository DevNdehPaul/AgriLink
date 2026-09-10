import { HttpInterceptorFn } from '@angular/common/http';
export const authInterceptor: HttpInterceptorFn=(req,next)=>{const token=localStorage.getItem('agri_access');return next(token?req.clone({setHeaders:{Authorization:`Bearer ${token}`}}):req);};
