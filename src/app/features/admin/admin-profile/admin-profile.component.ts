import {Component,inject} from '@angular/core';import {CommonModule} from '@angular/common';import {AuthService} from '../../../core/auth.service';
@Component({selector:'app-admin-profile',standalone:true,imports:[CommonModule],templateUrl:'./admin-profile.component.html',styleUrl:'./common.css'}) export class AdminProfileComponent{auth=inject(AuthService)}
