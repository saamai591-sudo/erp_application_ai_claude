-------------------------------------
CREATE   FUNCTION [STF].[StuffHasFlow] 
(
@ID INT
)
RETURNS BIT
 --WITH ENCRYPTION
AS
  
	BEGIN
DECLARE @Result BIT, @Count INT 

IF OBJECT_ID('STC.ReceiptCost') IS Not NULL
SET @Count = ISNULL((select COUNT(1)from STC.ReceiptCost
WHERE StuffID = @ID),0) 


IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.OutgoingItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.OutgoingItem
WHERE StuffID = @ID),0) 

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.ReturnedSaleJustificationItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.ReturnedSaleJustificationItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.StockReceiptItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.StockReceiptItem
WHERE StuffID = @ID),0)


IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.ReturnStockReceiptItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.ReturnStockReceiptItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.InvoiceItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.InvoiceItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.ReturnedOutgoingItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.ReturnedOutgoingItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.JustificationItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.JustificationItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('REQ.PurchaseRequestItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM REQ.PurchaseRequestItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('REQ.StuffRequestItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM REQ.StuffRequestItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.PricingItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.PricingItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.QuotationItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.QuotationItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('VND.ReturnInvoiceItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM VND.ReturnInvoiceItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.RecountingInventoryTagItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.RecountingInventoryTagItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.PriceListItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.PriceListItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('REQ.ReturnRequestItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM REQ.ReturnRequestItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('VND.PurchaseInvoiceItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM VND.PurchaseInvoiceItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.RemittanceItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.RemittanceItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STF.StuffDetail') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STF.StuffDetail
WHERE DamageStuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('CTM.OrderItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM CTM.OrderItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.ReturnedSaleInvoiceItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.ReturnedSaleInvoiceItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('APS.DimSaleItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM APS.DimSaleItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('AST.AssetReceiptItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM AST.AssetReceiptItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('AST.RepairServiceCost') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM AST.RepairServiceCost
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('AST.UtilizationCost') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM AST.UtilizationCost
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('CNT.ContractSubject') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM CNT.ContractSubject
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('CTM.ReceptionItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM CTM.ReceptionItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('FOS.LetterCreditBankCost') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM FOS.LetterCreditBankCost
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('FOS.ProformaInvoiceItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM FOS.ProformaInvoiceItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PMO.ProjectActivity') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PMO.ProjectActivity
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('POS.OrderFoodItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM POS.OrderFoodItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('POS.PosInvoiceItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM POS.PosInvoiceItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('POS.StationVitrinItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM POS.StationVitrinItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.CalculatedConversionCost') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.CalculatedConversionCost
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.CalculatedMaterialCost') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.CalculatedMaterialCost
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ConsumptionStatisticItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ConsumptionStatisticItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.CostDriverPeriodData') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.CostDriverPeriodData
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.MaterialPlanningSetting') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.MaterialPlanningSetting
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.PlanningItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.PlanningItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ProductionAnalysisItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ProductionAnalysisItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ProductionDeliveryItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ProductionDeliveryItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ProductionFormula') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ProductionFormula
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ProductionFormulaItemMaterial') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ProductionFormulaItemMaterial
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ProductionOrderItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ProductionOrderItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ProductionPlanningItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ProductionPlanningItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ProductionStatisticItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ProductionStatisticItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ProductionTiming') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ProductionTiming
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.RepairRequirementItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.RepairRequirementItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.RequiredMaterial') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.RequiredMaterial
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.RequiredProduct') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.RequiredProduct
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.ReworkItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.ReworkItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.SpoilageStatisticItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.SpoilageStatisticItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.StationPerformanceItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.StationPerformanceItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.StuffBomGroup') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.StuffBomGroup
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('PRM.WorkingInventoryItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM PRM.WorkingInventoryItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.DiscountAnnouncement') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.DiscountAnnouncement
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.PercentagePriceListItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.PercentagePriceListItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.PercentagePriceListItemBase') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.PercentagePriceListItemBase
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.PourcentageParameterMethod') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.PourcentageParameterMethod
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.PourcentageRate') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.PourcentageRate
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.PriceListItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.PriceListItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.PricingCalculationItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.PricingCalculationItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.PricingParameter') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.PricingParameter
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('SLE.SaleContractItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM SLE.SaleContractItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.ConvertSpecification') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.ConvertSpecification
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.InventoryEditionItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.InventoryEditionItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.JustificationInputItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.JustificationInputItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.OutgoingItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.OutgoingItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.ProductionPriceItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.ProductionPriceItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.ReturnedTemporaryStockReceiptItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.ReturnedTemporaryStockReceiptItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.StuffComposition') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.StuffComposition
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.TemporaryOutgoingItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.TemporaryOutgoingItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('STC.TemporaryStockReceiptItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM STC.TemporaryStockReceiptItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('VND.ProposalItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM VND.ProposalItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('VND.PurchaseContractItem') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM VND.PurchaseContractItem
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('WMS.Warehousing') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM WMS.Warehousing
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('WMS.ZoneInventory') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM WMS.ZoneInventory
WHERE StuffID = @ID),0)

IF (@Count is null or @Count = 0 ) and 
 OBJECT_ID('POS.StationFixService') IS Not NULL
SET @Count = ISNULL((select COUNT(1) FROM POS.StationFixService
WHERE POS.StationFixService.ServiceID = @ID),0)


IF (@Count is null or @Count = 0 )
SET @Result = 0
ELSE
SET @Result = 1

RETURN @Result
END
