/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

 
define(function(require){
    'use strict';

	var Backbone			= require('backbone');
	var XALinks 			= require('modules/XALinks');
	var XAEnums 			= require('utils/XAEnums');
	var XAUtil				= require('utils/XAUtils');
	var SessionMgr 			= require('mgrs/SessionMgr');
	var localization	= require('utils/XALangSupport');
	var RangerServiceList 	= require('collections/RangerServiceList');
	var RangerService 		= require('models/RangerService');
	var ServicemanagerlayoutTmpl = require('hbs!tmpl/common/ServiceManagerLayout_tmpl');
	var vUploadServicePolicy		= require('views/UploadServicePolicy');
	var vDownloadServicePolicy		= require('views/DownloadServicePolicy');
    var RangerServiceViewDetail = require('views/service/RangerServiceViewDetail');
    var App    =require('App');
	require('Backbone.BootstrapModal');
	return Backbone.Marionette.Layout.extend(
	/** @lends Servicemanagerlayout */
	{
		_viewName : name,
		
    	template: ServicemanagerlayoutTmpl,

		templateHelpers: function(){
			return {
				operation 	: SessionMgr.isSystemAdmin() || SessionMgr.isKeyAdmin(),
                serviceDefs : this.componentCollectionModels(App.vZone.vZoneName),
                services    : this.componentServicesModels(App.vZone.vZoneName),
                showImportExportBtn : (SessionMgr.isUser() || XAUtil.isAuditorOrKMSAuditor(SessionMgr)) ? false : true,
                isZoneAdministration : (SessionMgr.isSystemAdmin()|| SessionMgr.isUser() || SessionMgr.isAuditor()) ? true : false,
                isServiceManager : (App.vZone && _.isEmpty(App.vZone.vZoneName)) ? true : false,
			};
			
		},
    	breadCrumbs :function(){
            if(this.type == "tag"){
                if(App.vZone && App.vZone.vZoneName && !_.isEmpty(App.vZone.vZoneName)){
                    return [XALinks.get('TagBasedServiceManager', App.vZone.vZoneName)];
                }else{
                    return [XALinks.get('TagBasedServiceManager')];
                }
            }else{
                if(App.vZone && App.vZone.vZoneName && !_.isEmpty(App.vZone.vZoneName)){
                    return [XALinks.get('ServiceManager', App.vZone.vZoneName)];
                }else{
                    return [XALinks.get('ServiceManager')];
                }
            }
        },

		/** Layout sub regions */
    	regions: {},

    	/** ui selector cache */
    	ui: {
    		'btnDelete' : '.deleteRepo',
    		'downloadReport'      : '[data-id="downloadBtnOnService"]',
    		'uploadServiceReport' :'[data-id="uploadBtnOnServices"]',
    		'exportReport'      : '[data-id="exportBtn"]',
            'importServiceReport' :'[data-id="importBtn"]',
            'viewServices' : '[data-name="viewService"]',
            'selectZoneName' : '[data-id="selectZoneName"]'

    	},

		/** ui events hash */
		events : function(){
			var events = {};
			events['click ' + this.ui.btnDelete]	= 'onDelete';
			events['click ' + this.ui.downloadReport]	= 'downloadReport';
			events['click ' + this.ui.uploadServiceReport]	= 'uploadServiceReport';
			events['click ' + this.ui.exportReport]	= 'downloadReport';
			events['click ' + this.ui.importServiceReport]	= 'uploadServiceReport';
            events['click ' + this.ui.viewServices]   = 'viewServices';
            events['click ' + this.ui.selectZoneName]   = 'selectZoneName';
			return events;
		},
    	/**
		* intialize a new Servicemanagerlayout Layout 
		* @constructs
		*/
		initialize: function(options) {
			console.log("initialized a Servicemanagerlayout Layout");
			this.services = new RangerServiceList();	
                        _.extend(this, _.pick(options, 'collection','type', 'rangerZoneList'));
			this.bindEvents();
			this.initializeServices();
            if (!App.vZone) {
                App.vZone = {
                    vZoneName: ""
                }
            }
        },

		/** all events binding here */
		bindEvents : function(){
			/*this.listenTo(communicator.vent,'someView:someEvent', this.someEventHandler, this)'*/
			this.listenTo(this.collection, "sync", this.render, this);
			this.listenTo(this.collection, "request", function(){
				this.$('[data-id="r_tableSpinner"]').removeClass('display-none').addClass('loading');
			}, this);
		},

		/** on render callback */
		onRender: function() {
			this.$('[data-id="r_tableSpinner"]').removeClass('loading').addClass('display-none');
			this.initializePlugins();
            if (this.rangerZoneList.length > 0) {
                this.ui.selectZoneName.removeAttr('disabled');
                this.$el.find('.zoneEmptyMsg').removeAttr('title');
            }
            this.selectZoneName();
        },
		/** all post render plugin initialization */
		initializePlugins: function(){

		},

		initializeServices : function(){
			this.services.setPageSize(100);
			this.services.fetch({
			   cache : false,
			   async : false
			});

		},
		downloadReport : function(e){
			var that = this;
			if(SessionMgr.isKeyAdmin()){
				if(this.services.length == 0){
					XAUtil.alertBoxWithTimeSet(localization.tt('msg.noServiceToExport'));
					return;
				}
			}
			var el = $(e.currentTarget), serviceType = el.attr('data-servicetype');
			if(serviceType){
				var componentServices = this.services.where({'type' : serviceType });
                    if(componentServices.length == 0 ){
	            	XAUtil.alertBoxWithTimeSet(localization.tt('msg.noServiceToExport'));
	            	return;
	            }
			}else{
				if(SessionMgr.isSystemAdmin()){
					if(location.hash == "#!/policymanager/resource"){
						var servicesList = _.omit(this.services.groupBy('type'),'tag','kms');
						if(_.isEmpty(servicesList)){
							XAUtil.alertBoxWithTimeSet(localization.tt('msg.noServiceToExport'));
							return;
						}
					}else{
						var servicesList = _.pick(this.services.groupBy('type'),'tag');
						if(_.isEmpty(servicesList)){
							XAUtil.alertBoxWithTimeSet(localization.tt('msg.noServiceToExport'));
							return;
						}
						
					}
				}
			}
			
			 var view = new vDownloadServicePolicy({
              	serviceType		:serviceType,
				collection 		: new Backbone.Collection([""]),
				serviceDefList	: this.collection,
                                services		: this.services,
                zoneServiceDefList : this.componentCollectionModels(this.ui.selectZoneName.val()),
                zoneServices    : this.componentServicesModels(this.ui.selectZoneName.val()),

			});
            var modal = new Backbone.BootstrapModal({
				content	: view,
				title	: 'Export Policy',
				okText  :"Export",
				animate : true
			}).open();
			
		},
		uploadServiceReport :function(e){
		    var that = this;
		    if(SessionMgr.isKeyAdmin()){
				if(this.services.length == 0){
					XAUtil.alertBoxWithTimeSet(localization.tt('msg.noServiceToImport'));
					return;
				}
			}
		    var el = $(e.currentTarget), serviceType = el.attr('data-servicetype');
			if(serviceType){
				var componentServices = this.services.where({'type' : serviceType });
                    if(componentServices.length == 0 ){
	            	XAUtil.alertBoxWithTimeSet(localization.tt('msg.noServiceToImport'));
	            	return;
	            }	
			}else{
				if(SessionMgr.isSystemAdmin()){
	            	if(location.hash=="#!/policymanager/resource"){
	                	var servicesList = _.omit(this.services.groupBy('type'),'tag','kms')
	                	if(_.isEmpty(servicesList)){
	                		XAUtil.alertBoxWithTimeSet(localization.tt('msg.noServiceToImport'));
	    					return;
	                	}
	                }else{
	                	var servicesList = _.pick(this.services.groupBy('type'),'tag')
	                	if(_.isEmpty(servicesList)){
	                		XAUtil.alertBoxWithTimeSet(localization.tt('msg.noServiceToImport'));
	    					return;
	                	}
	                	
	                }
	            }
				
			}
			var view = new vUploadServicePolicy({
				serviceType		: serviceType,
				collection 		: new Backbone.Collection(),
				serviceDefList	: this.collection,
				services		: this.services,
				rangerZoneList  : this.rangerZoneList,
            });
			var modal = new Backbone.BootstrapModal({
				content	: view,	
				okText 	:"Import",
                                title	: App.vZone && App.vZone.vZoneName && !_.isEmpty(App.vZone.vZoneName) ? 'Import Policy For Zone' : 'Import Policy',
				animate : true
			}).open();

		},
		onDelete : function(e){
			var that = this;
			var model = this.services.get($(e.currentTarget).data('id'));
			if(model){
				model = new RangerService(model.attributes);
				XAUtil.confirmPopup({
					msg :'Are you sure want to delete ?',
					callback : function(){
						XAUtil.blockUI();
						model.destroy({
							success: function(model, response) {
								XAUtil.blockUI('unblock');
								that.services.remove(model.get('id'));
								XAUtil.notifySuccess('Success', 'Service deleted successfully');
								that.render();
							},
							error :function(model, response) {
								XAUtil.blockUI('unblock');
                                if(!_.isUndefined(response) && !_.isUndefined(response.responseJSON) && !_.isUndefined(response.responseJSON.msgDesc && response.status !='419')){
									XAUtil.notifyError('Error', response.responseJSON.msgDesc);
								}
							}
						});
					}
				});
			}
		},
        viewServices : function(e){
            var that =this;
            var serviceId =  $(e.currentTarget).data('id');
            var rangerService = that.services.find(function(m){return m.id == serviceId});
            var serviceDef = that.collection.find(function(m){return m.get('name') == rangerService.get('type')});
            var view = new RangerServiceViewDetail({
                serviceDef : serviceDef,
                rangerService : rangerService,

            });
            var modal = new Backbone.BootstrapModal({
                animate : true,
                content     : view,
                title: localization.tt("h.serviceDetails"),
                okText :localization.tt("lbl.ok"),
                allowCancel : true,
                escape : true
            }).open();
            modal.$el.find('.cancel').hide();
        },
        selectZoneName : function(){
            var that = this;
            var zoneName = _.map(this.rangerZoneList.models, function(m){
                return { 'id':m.get('name'), 'text':m.get('name'), 'zoneId' : m.get('id')}
            });
            if(!_.isEmpty(App.vZone.vZoneName) && !_.isUndefined(App.vZone.vZoneName)){
                this.ui.selectZoneName.val(App.vZone.vZoneName);
            }
            var servicesModel = _.clone(that.services);
            this.ui.selectZoneName.select2({
                closeOnSelect: false,
                maximumSelectionSize : 1,
                width: '220px',
                allowClear: true,
                data: zoneName,
                placeholder: 'Select Zone Name',
            }).on('change', function(e){
                App.vZone.vZoneName = e.val;
                if(e.added){
                    App.vZone.vZoneId = e.added.zoneId;
                } else {
                    App.vZone.vZoneId = null;
                }
                var rBreadcrumbsText = !_.isEmpty(App.vZone.vZoneName) ? 'Service Manager : ' + App.vZone.vZoneName + ' zone' : 'Service Manager';
                App.rBreadcrumbs.currentView.breadcrumb[0].text = rBreadcrumbsText;
                App.rBreadcrumbs.currentView.render()
                that.render();
                that.ui.selectZoneName.select2('val', e.val);
            });
        },

        componentCollectionModels: function(zoneName) {
            var that = this;
            if (!_.isEmpty(zoneName) && !_.isUndefined(zoneName) && this.type !== XAEnums.ServiceType.SERVICE_TAG.label) {
                var serviceType = _.keys(that.componentServicesModels(zoneName));
                return that.collection.filter(function(model) {
                    return serviceType.indexOf(model.get("name")) !== -1;
                })
            } else {
                return that.collection.models;
            }
        },

        componentServicesModels: function(zoneName) {
            var that = this;
            if(!_.isEmpty(zoneName) && !_.isUndefined(zoneName) && that.rangerZoneList.length > 0){
                var selectedZone = that.rangerZoneList.find(function(m) {
                    return zoneName === m.get('name');
                });
            }
            if (selectedZone && !_.isEmpty(selectedZone)) {
                var selectedZoneServices = [], model;
                if(this.type !== XAEnums.ServiceType.SERVICE_TAG.label){
                    _.each(selectedZone.get('services'), function(value, key) {
                        model = that.services.find(function(m) {
                            return m.get('name') == key
                        });
                        if (model) {
                            selectedZoneServices.push(model);
                        }
                    });
                }else{
                    _.each(selectedZone.get('tagServices'), function(value){
                        model = that.services.find(function(m) {
                            return m.get('name') == value
                        });
                        if (model) {
                            selectedZoneServices.push(model);
                        }
                    })
                }
                return _.groupBy(selectedZoneServices, function(m) {
                        return m.get('type')
                });
            } else {
                return that.services.groupBy("type")
            }
        },

		/** on close */
		onClose: function(){
            XAUtil.removeUnwantedDomElement();
		}

	});
});
