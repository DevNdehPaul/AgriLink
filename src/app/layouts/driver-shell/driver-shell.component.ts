import {Component,ChangeDetectorRef,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink,RouterLinkActive,RouterOutlet} from '@angular/router';
import {finalize} from 'rxjs';
import {AuthService} from '../../core/auth.service';
@Component({selector:'app-driver-shell',standalone:true,imports:[CommonModule,RouterOutlet,RouterLink,RouterLinkActive],templateUrl:'./driver-shell.component.html',styleUrl:'./driver-shell.component.css'})
export class DriverShellComponent{auth=inject(AuthService);private cdr=inject(ChangeDetectorRef);menu=false;ngOnInit(){this.auth.me().pipe(finalize(()=>this.cdr.detectChanges())).subscribe({error:()=>{}})}close(){this.menu=false}}
