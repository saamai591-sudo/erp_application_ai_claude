Create   VIEW [REQ].PurchaseRequest_Remains
AS 

	with cte1 as
	  (
            SELECT PurchaseRequestItemID,
                    SUM(MainQuantity) AS MainQuantity,
                    SUM(SubQuantity) AS SubQuantity
            FROM   VND.PurchaseInvoiceItem AS pri
			where PurchaseRequestItemID is not null
            GROUP BY PurchaseRequestItemID	  

			union all

            SELECT PurchaseRequestItemID,
                    SUM(MainQuantity) AS MainQuantity,
                    SUM(SubQuantity) AS SubQuantity
            FROM   STC.StockReceiptItem AS pri
			where PurchaseRequestItemID is not null
            GROUP BY PurchaseRequestItemID

			union all

            SELECT PurchaseRequestItemID,
                    SUM(MainQuantity) AS MainQuantity,
                    SUM(SubQuantity) AS SubQuantity
            FROM   STC.JustificationInputItem AS pri
			where PurchaseRequestItemID is not null
            GROUP BY PurchaseRequestItemID

			union all

            SELECT PurchaseRequestItemID,
                    SUM(MainQuantity) AS MainQuantity,
                    SUM(SubQuantity) AS SubQuantity
            FROM   fos.ProformaInvoiceItem AS pri
			where PurchaseRequestItemID is not null
            GROUP BY PurchaseRequestItemID

			union all

            SELECT PurchaseRequestItemID,
                    SUM(MainQuantity) AS MainQuantity,
                    SUM(SubQuantity) AS SubQuantity
            FROM   Stc.TemporaryStockReceiptItem AS pri
			where PurchaseRequestItemID is not null
            GROUP BY PurchaseRequestItemID
			
			UNION all

            SELECT PurchaseRequestItemID,
                    SUM(Quantity) AS MainQuantity,
                    0 AS SubQuantity
            FROM  REQ.TenderRequestItem AS tri
			WHERE PurchaseRequestItemID is not null
            GROUP BY PurchaseRequestItemID

			union all

            SELECT PurchaseRequestItemID,
                    SUM(MainQuantity) AS MainQuantity,
                    SUM(SubQuantity) AS SubQuantity
            FROM   VND.PurchaseContractItem AS pri
			where PurchaseRequestItemID is not null
            GROUP BY PurchaseRequestItemID

			union all

            SELECT PurchaseRequestItemID,
                    SUM(MainQuantity) AS MainQuantity,
                    SUM(SubQuantity) AS SubQuantity
            FROM   VND.PurchasePlanningItem 
			where PurchaseRequestItemID is not null
            GROUP BY PurchaseRequestItemID
	  ),
	  cte2 as
	  (
			SELECT rri.PurchaseRequestItemID,
				   rri.AcceptRequestMainMeasureQuantity,
				   rri.AcceptRequestSubMeasureQuantity,
				   case when pc.ProposalCommissionID is not null 
							then rri.AcceptRequestMainMeasureQuantity
						else isnull(T.DoMainQuantity,0)
						end DoMainQuantity,
				   case when pc.ProposalCommissionID is not null 
							then rri.AcceptRequestSubMeasureQuantity
						else isnull(T.DoSubQuantity,0)
						end DoSubQuantity
			FROM   req.PurchaseRequestItem AS rri
			LEFT JOIN 
			(SELECT a.ProposalCommissionID,c.PurchaseRequestItemID
			 FROM vnd.ProposalCommission a
			 join vnd.ProposalCommissionItem d on a.ProposalCommissionID = d.ProposalCommissionID
			 join req.PurchaseRequest b on a.PurchaseRequestID = b.PurchaseRequestID
			 join req.PurchaseRequestItem c on c.PurchaseRequestID = b.PurchaseRequestID
			 join vnd.ProposalItem pi on pi.PurchaseRequestItemID = c.PurchaseRequestItemID and d.ProposalItemID = pi.ProposalItemID
			 ) pc on pc.PurchaseRequestItemID = rri.PurchaseRequestItemID
			LEFT JOIN 
			(
				select PurchaseRequestItemID,
						Sum(MainQuantity) DoMainQuantity,
						Sum(SubQuantity) DoSubQuantity
				from cte1
				GROUP BY PurchaseRequestItemID
			)T ON  T.PurchaseRequestItemID = rri.PurchaseRequestItemID   
	)
	select  PurchaseRequestItemID,
			AcceptRequestMainMeasureQuantity,
			AcceptRequestSubMeasureQuantity,
			DoMainQuantity,
			DoSubQuantity,
			AcceptRequestMainMeasureQuantity - isnull(DoMainQuantity,0)  AS Non,
			AcceptRequestSubMeasureQuantity - isnull(DoSubQuantity,0)    AS NonSub
	from cte2;
