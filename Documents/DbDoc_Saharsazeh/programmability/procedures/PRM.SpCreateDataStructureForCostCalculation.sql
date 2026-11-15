--------------------------------------- START #without task

CREATE     proc [PRM].SpCreateDataStructureForCostCalculation
AS

DECLARE @TraceID varchar(20)
DECLARE @query NVARCHAR(MAX)

DECLARE db_cursor1 CURSOR FOR 
SELECT TraceID 
FROM STF.Trace t
where t.IsEffectiveInProduceCost = 1

OPEN db_cursor1  
FETCH NEXT FROM db_cursor1 INTO @TraceID  

WHILE @@FETCH_STATUS = 0  
BEGIN  
	select @query = N'
	 if COL_LENGTH(''PRM.PeriodProduction'','''+@TraceID+''') is null
      alter table [PRM].[PeriodProduction] add ['+@TraceID+'] nvarchar(1024)
	  
	 if COL_LENGTH(''PRM.Production_FirstWorkingInventory'','''+@TraceID+''') is null
      alter table [PRM].[Production_FirstWorkingInventory] add ['+@TraceID+'] nvarchar(1024)
	  '
	  exec(@query)
      FETCH NEXT FROM db_cursor1 INTO @TraceID 
END 

CLOSE db_cursor1  
DEALLOCATE db_cursor1 


DECLARE db_cursor12 CURSOR FOR 
SELECT TraceID 
FROM STF.Trace t
where t.IsEffectiveInProduceCost <> 1

OPEN db_cursor12  
FETCH NEXT FROM db_cursor12 INTO @TraceID  

WHILE @@FETCH_STATUS = 0  
BEGIN  
	select @query = N'
	 if COL_LENGTH(''PRM.PeriodProduction'','''+@TraceID+''') is NOT null
      alter table [PRM].[PeriodProduction] DROP COLUMN ['+@TraceID+']
	  
	 if COL_LENGTH(''PRM.Production_FirstWorkingInventory'','''+@TraceID+''') is NOT null
      alter table [PRM].[Production_FirstWorkingInventory] DROP COLUMN  ['+@TraceID+']
	  '
	  exec(@query)
      FETCH NEXT FROM db_cursor12 INTO @TraceID 
END 

CLOSE db_cursor12 
DEALLOCATE db_cursor12

DECLARE db_cursor2 CURSOR FOR 
SELECT TraceID 
FROM STF.Trace t
where t.IsEffectiveInConsumeCost = 1

OPEN db_cursor2  
FETCH NEXT FROM db_cursor2 INTO @TraceID  

WHILE @@FETCH_STATUS = 0  
BEGIN  
	select @query = N'
	 
	if COL_LENGTH(''PRM.PeriodProductionBOM'','''+@TraceID+''') is null
      alter table [PRM].[PeriodProductionBOM] add ['+@TraceID+'] nvarchar(1024)

	 if COL_LENGTH(''PRM.Consumption_FirstWorkingInventory'','''+@TraceID+''') is null
      alter table [PRM].[Consumption_FirstWorkingInventory] add ['+@TraceID+'] nvarchar(1024)
	  
	 if COL_LENGTH(''PRM.Consumption_Outgoing'','''+@TraceID+''') is null
      alter table [PRM].[Consumption_Outgoing] add ['+@TraceID+'] nvarchar(1024)
	  
	 if COL_LENGTH(''PRM.Consumption_ReturnedOutgoing'','''+@TraceID+''') is null
      alter table [PRM].[Consumption_ReturnedOutgoing] add ['+@TraceID+'] nvarchar(1024)
	  
	 if COL_LENGTH(''PRM.Consumption_LastWorkingInventory'','''+@TraceID+''') is null
      alter table [PRM].[Consumption_LastWorkingInventory] add ['+@TraceID+'] nvarchar(1024)
	  
	 if COL_LENGTH(''PRM.Consumption_ProductionDelivery'','''+@TraceID+''') is null
      alter table [PRM].[Consumption_ProductionDelivery] add ['+@TraceID+'] nvarchar(1024)
	  
	 if COL_LENGTH(''PRM.Consumption'','''+@TraceID+''') is null
      alter table [PRM].[Consumption] add ['+@TraceID+'] nvarchar(1024)

	  '
	  exec(@query)
      FETCH NEXT FROM db_cursor2 INTO @TraceID 
END 

CLOSE db_cursor2  
DEALLOCATE db_cursor2 

DECLARE db_cursor21 CURSOR FOR 
SELECT TraceID 
FROM STF.Trace t
where t.IsEffectiveInConsumeCost <> 1

OPEN db_cursor21  
FETCH NEXT FROM db_cursor21 INTO @TraceID  

WHILE @@FETCH_STATUS = 0  
BEGIN  
	select @query = N'
	 
	if COL_LENGTH(''PRM.PeriodProductionBOM'','''+@TraceID+''') is not null
      alter table [PRM].[PeriodProductionBOM] DROP COLUMN ['+@TraceID+'] 

	 if COL_LENGTH(''PRM.Consumption_FirstWorkingInventory'','''+@TraceID+''') is not null
      alter table [PRM].[Consumption_FirstWorkingInventory] DROP COLUMN ['+@TraceID+'] 
	  
	 if COL_LENGTH(''PRM.Consumption_Outgoing'','''+@TraceID+''') is not null
      alter table [PRM].[Consumption_Outgoing] DROP COLUMN ['+@TraceID+']
	  
	 if COL_LENGTH(''PRM.Consumption_ReturnedOutgoing'','''+@TraceID+''') is not null
      alter table [PRM].[Consumption_ReturnedOutgoing] DROP COLUMN ['+@TraceID+'] 
	  
	 if COL_LENGTH(''PRM.Consumption_LastWorkingInventory'','''+@TraceID+''') is not null
      alter table [PRM].[Consumption_LastWorkingInventory] DROP COLUMN ['+@TraceID+']
	  
	 if COL_LENGTH(''PRM.Consumption_ProductionDelivery'','''+@TraceID+''') is not null
      alter table [PRM].[Consumption_ProductionDelivery] DROP COLUMN ['+@TraceID+']
	  
	 if COL_LENGTH(''PRM.Consumption'','''+@TraceID+''')  is not null
      alter table [PRM].[Consumption] DROP COLUMN ['+@TraceID+']

	  '
	  exec(@query)
      FETCH NEXT FROM db_cursor21 INTO @TraceID 
END 

CLOSE db_cursor21  
DEALLOCATE db_cursor21 
