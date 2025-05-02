import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900 mb-6">Site Settings</h1>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent mb-6">
          <TabsTrigger value="general" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            General
          </TabsTrigger>
          <TabsTrigger value="sla" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            SLA Settings
          </TabsTrigger>
          <TabsTrigger value="departments" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Departments
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-none bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
            Notifications
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure the basic settings for your ticket system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input id="company-name" defaultValue="Ticket Lead" />
                </div>
                <div>
                  <Label htmlFor="support-email">Support Email</Label>
                  <Input id="support-email" defaultValue="support@ticketlead.example" type="email" />
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <h3 className="font-medium">Allow Customer Registration</h3>
                  <p className="text-sm text-neutral-500">Let customers register and create their own accounts</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex justify-end">
                <Button>Save Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sla">
          <Card>
            <CardHeader>
              <CardTitle>SLA Configuration</CardTitle>
              <CardDescription>Set up response time requirements by priority</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="low-priority">Low Priority SLA (hours)</Label>
                    <Input id="low-priority" type="number" defaultValue="48" />
                  </div>
                  <div>
                    <Label htmlFor="medium-priority">Medium Priority SLA (hours)</Label>
                    <Input id="medium-priority" type="number" defaultValue="24" />
                  </div>
                  <div>
                    <Label htmlFor="high-priority">High Priority SLA (hours)</Label>
                    <Input id="high-priority" type="number" defaultValue="8" />
                  </div>
                  <div>
                    <Label htmlFor="critical-priority">Critical Priority SLA (hours)</Label>
                    <Input id="critical-priority" type="number" defaultValue="4" />
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div>
                  <h3 className="font-medium">SLA Breach Notifications</h3>
                  <p className="text-sm text-neutral-500">Send alerts when SLA timeframes are about to be breached</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex justify-end">
                <Button>Save SLA Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle>Department Management</CardTitle>
              <CardDescription>Set up and manage support departments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <h3 className="font-medium">Technical Support</h3>
                    <p className="text-sm text-neutral-500">For technical and product issues</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="destructive" size="sm">Delete</Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <h3 className="font-medium">Billing</h3>
                    <p className="text-sm text-neutral-500">For payment and invoice inquiries</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="destructive" size="sm">Delete</Button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <h3 className="font-medium">Customer Service</h3>
                    <p className="text-sm text-neutral-500">For general inquiries and assistance</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Edit</Button>
                    <Button variant="destructive" size="sm">Delete</Button>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure when and how notifications are sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">New Ticket Notifications</h3>
                    <p className="text-sm text-neutral-500">Send notifications when new tickets are created</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Ticket Reply Notifications</h3>
                    <p className="text-sm text-neutral-500">Send notifications when tickets receive replies</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Status Change Notifications</h3>
                    <p className="text-sm text-neutral-500">Send notifications when ticket status changes</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Assignment Notifications</h3>
                    <p className="text-sm text-neutral-500">Send notifications when tickets are assigned</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button>Save Notification Settings</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
