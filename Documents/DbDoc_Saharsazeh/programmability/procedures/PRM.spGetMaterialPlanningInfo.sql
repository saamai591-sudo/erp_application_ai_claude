
-------------------------------------
CREATE    PROCEDURE PRM.spGetMaterialPlanningInfo
(@ToDate DATETIME)
--WITH ENCRYPTION
AS
BEGIN TRY
	DECLARE @UserID        INT,
	        @Culture       VARCHAR(5),
	        @CultureNo     TINYINT	    
	
	SET @UserID = CFG.GetuserID();
	SET @Culture = cfg.GetuserCulture()
	
	SELECT @CultureNo = CultureNo
	FROM   CFG.CultureInfo
	WHERE  Culture = @Culture
	
	
	
	
	
	SELECT c.StuffID,
	       SUM(c.MainQuantity) MainQuantity
	INTO   #Cardex
	FROM   STC.VwCardex c
	INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = c.StockID
	GROUP BY
	       c.StuffID
	
	SELECT t.StuffID,
	       SUM(r.Non) AS Remain
	INTO   #TemporaryStockReceipt
	FROM   STC.TemporaryStockReceiptItem t
	       JOIN STC.fn_TemporaryStockReceipt_Remains(null, null, @ToDate, 1) r
	            ON  t.TemporaryStockReceiptItemID = r.TemporaryStockReceiptItemID
	GROUP BY
	       t.StuffID
	
	SELECT j.StuffID,
	       SUM(r.Non) Remain
	INTO   #JustificationInput
	FROM   STC.JustificationInputItem j
	       JOIN STC.JustificationInput_Remains r
	            ON  j.JustificationInputItemID = r.JustificationInputItemID
	GROUP BY
	       j.StuffID
	
	SELECT i.StuffID,
	       SUM(r.Non) Remain
	INTO   #PurchaseContract
	FROM   VND.PurchaseContractItem i
	       JOIN VND.PurchaseContract_Remains r
	            ON  i.PurchaseContractItemID = r.PurchaseContractItemID
	GROUP BY
	       i.StuffID
	
	SELECT i.StuffID,
	       SUM(r.Non) Remain
	INTO   #PurchaseRequestItem
	FROM   REQ.PurchaseRequestItem i
	       JOIN REQ.PurchaseRequest_Remains r
	            ON  i.PurchaseRequestItemID = r.PurchaseRequestItemID
	GROUP BY
	       i.StuffID
	
	SELECT i.StuffID,
	       SUM(r.Non) Remain
	INTO   #PurchaseInvoice
	FROM   VND.PurchaseInvoiceItem i
	       JOIN VND.PurchaseInvoice_Remains r
	            ON  i.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
	where isnull(i.StockReceiptItemID,0) = 0
	GROUP BY
	       i.StuffID
	
	
	SELECT pfim.StuffID,
	       SUM(a.Quatity * pfim.Quantity / pf.Quantity) AS RequiredQuantity
	INTO   #T
	FROM   prm.ProductionFormula AS pf
	       JOIN (
	                SELECT a.StuffID,
	                       a.DeliveryDate,
	                       SUM(MainQuantityRemain) Quatity
	                FROM   (
	                           SELECT poi.StuffID,
	                                  CAST(poi.DeliveryDate AS DATE) AS DeliveryDate,
	                                  vpoiur.MainQuantityRemain
	                           FROM   prm.ProductionOrder AS po
	                                  JOIN prm.ProductionOrderItem AS poi
	                                       ON  poi.ProductionOrderID = po.ProductionOrderID
	                                  JOIN prm.vwProductionOrderItem_UnplannedRemain AS vpoiur
	                                       ON  vpoiur.ProductionOrderItemID = poi.ProductionOrderItemID
	                           UNION ALL
	                           SELECT ppi.StuffID,
	                                  CAST(pp.StartDate AS DATE) DeliveryDate,
	                                  ppi.MainQuantity -ISNULL(ps.MainQuantity, 0) AS Remain
	                           FROM   prm.ProductionPlanning AS pp
	                                  JOIN prm.ProductionPlanningItem AS ppi
	                                       ON  ppi.ProductionPlanningID = pp.ProductionPlanningID
	                                  LEFT   JOIN prm.ProductionStatisticItem AS ps
	                                       ON  ps.ProductionPlanningItemID = ppi.ProductionPlanningItemID
	                       ) a
	                GROUP BY
	                       a.StuffID,
	                       a.DeliveryDate
	            ) a
	            ON  pf.StuffID = a.StuffID
	       JOIN prm.ProductionFormulaItem AS pfi
	            ON  pfi.ProductionFormulaID = pf.ProductionFormulaID
	       JOIN prm.ProductionFormulaItemMaterial AS pfim
	            ON  pfim.ProductionFormulaItemID = pfi.ProductionFormulaItemID
	WHERE  a.DeliveryDate <= @ToDate
	GROUP BY
	       pfim.StuffID
	
	SELECT #T.StuffID,
	       s.Code                AS StuffCode,
	       s.Title               AS StuffTitle,
	       mu.Title              AS MainMeasureUnitTitle,
	       CASE 
	            WHEN (
	                     RequiredQuantity 
	                     - ISNULL(#Cardex.MainQuantity, 0)
	                     - ISNULL(#TemporaryStockReceipt.Remain, 0)
	                     - ISNULL(#JustificationInput.remain, 0)
	                     - ISNULL(#PurchaseContract.remain, 0)
	                     - ISNULL(#PurchaseRequestItem.remain, 0)
	                     - ISNULL(#PurchaseInvoice.remain, 0)
	                 ) > 0 THEN (
	                     RequiredQuantity 
	                     - ISNULL(#Cardex.MainQuantity, 0)
	                     - ISNULL(#TemporaryStockReceipt.Remain, 0)
	                     - ISNULL(#JustificationInput.remain, 0)
	                     - ISNULL(#PurchaseContract.remain, 0)
	                     - ISNULL(#PurchaseRequestItem.remain, 0)
	                     - ISNULL(#PurchaseInvoice.remain, 0)
	                 )
	            ELSE 0
	       END                   AS RequiredQuantity
	FROM   #T
	       JOIN stf.[Stuff]      AS s
	            ON  #T.StuffID = s.StuffID
	       JOIN stf.MeasureUnit  AS mu
	            ON  mu.MeasureUnitID = s.MainMeasureUnitID
	       LEFT JOIN #Cardex
	            ON  #Cardex.StuffID = s.StuffID
	       LEFT JOIN #TemporaryStockReceipt
	            ON  #TemporaryStockReceipt.stuffid = s.stuffid
	       LEFT JOIN #JustificationInput
	            ON  #JustificationInput.stuffid = s.stuffid
	       LEFT JOIN #PurchaseContract
	            ON  #PurchaseContract.stuffid = s.stuffid
	       LEFT JOIN #PurchaseRequestItem
	            ON  #PurchaseRequestItem.stuffid = s.stuffid
	       LEFT JOIN #PurchaseInvoice
	            ON  #PurchaseInvoice.stuffid = s.stuffid
END TRY
BEGIN CATCH
	DECLARE @ErrorMessage NVARCHAR(4000);
	DECLARE @ErrorSeverity INT;
	DECLARE @ErrorState INT;
	
	SELECT @ErrorMessage = ERROR_MESSAGE(),
	       @ErrorSeverity     = ERROR_SEVERITY(),
	       @ErrorState        = ERROR_STATE();
	
	
	RAISERROR (
	    @ErrorMessage,	-- Message text.
	    @ErrorSeverity,	-- Severity.
	    @ErrorState -- State.
	);
END CATCH
