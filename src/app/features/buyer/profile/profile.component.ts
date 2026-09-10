import {Component,inject,ChangeDetectorRef} from '@angular/core';import {CommonModule} from '@angular/common';import {AuthService} from '../../../core/auth.service';
import {finalize} from 'rxjs';
@Component({selector:'app-profile',standalone:true,imports:[CommonModule],templateUrl:'./profile.component.html',styleUrl:'./profile.component.css'}) export class ProfileComponent{cdr=inject(ChangeDetectorRef);auth=inject(AuthService);loading=true;ngOnInit(){this.auth.me().pipe(finalize(()=>this.cdr.detectChanges())).subscribe({next:()=>this.loading=false,error:()=>this.loading=false})}}
