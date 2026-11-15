
--------------------------------------------------------------------------
CREATE   VIEW [CFG].VWSaleAndPurchaseBill
--with encryption
as

	SELECT i.CustomerOpeningBalanceID DocumentID,
	       'SaleManager.CustomerOpeningBalance' EngName,
	       'Customer' [Type],
	       null [Date],
		   case when i.BalanceType=0 then i.OpeningBalance else - i.OpeningBalance end OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   0 Received,
		   0 Payed,
		   i.CurrencyID,
		   i.CustomerID PartyID
	FROM SLE.CustomerOpeningBalance i
	 left join cfg.RecordLevelAccess rla on i.CustomerID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE rla.UserID IS null

	union all

	SELECT i.VendorOpeningBalanceID DocumentID,
	       'VendorManager.VendorOpeningBalance' EngName,
		   'Vendor' [Type],
	       null [Date],
		   case when i.BalanceType=0 then i.OpeningBalance else - i.OpeningBalance end OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   0 Received,
		   0 Payed,
		   i.CurrencyID,
		   i.VendorID PartyID
	FROM VND.VendorOpeningBalance  i
		 left join cfg.RecordLevelAccess rla on i.VendorID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE rla.UserID IS null
	union all

	SELECT i.InvoiceID DocumentID,
	       'SaleManager.Invoice' EngName,
		   'Customer' [Type],
		   i.Date [Date],
		   0 OpeningBalance,
		   TotalPrice SalePurchase,
		   0 Returned,
		   -TotalDiscount Discount,
		   TotalDuty + TotalTax Vat,
		   0 Received,
		   0 Payed,
		   i.CurrencyID,
		   i.CustomerID PartyID
	FROM SLE.Invoice i
	left join
	(
		SELECT  EntityRef
		FROM    CFG.RecordLevelAccess r 
		WHERE r.Type = 16
		and   r.UserID = CFG.GetuserID()
	)Access 
		on Access.EntityRef = i.SaleAreaID
	 left join cfg.RecordLevelAccess rla on i.CustomerID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()

	WHERE i.SaleInvoiceStatus <> 2 
	and
	((select lower(ConfigValue) 
		from CFG.Configuration
		where ConfigKey = 'InvoiceNeedConfirm') = 'false' or i.SaleInvoiceStatus=3)
	AND(  cfg.GetuserID() = -1 
						or Access.EntityRef is null
	)
	AND rla.UserID IS NULL

	union all

	SELECT i.ReturnedSaleInvoiceID DocumentID,
	       'SaleManager.ReturnedSaleInvoice' EngName,
		   'Customer' [Type],
	       i.Date [Date],
		   0 OpeningBalance,
		   0 SalePurchase,
		   -TotalPrice Returned,
		   TotalDiscount Discount,
		   -(TotalDuty + TotalTax) Vat,
		   0 Received,
		   0 Payed,
		   i.CurrencyID,
	       i.CustomerID PartyID
	FROM SLE.ReturnedSaleInvoice i
	left join
	(
		SELECT  EntityRef
		FROM    CFG.RecordLevelAccess r 
		WHERE r.Type = 16
		and   r.UserID = CFG.GetuserID()
	)Access 
		on Access.EntityRef = i.SaleAreaID
		 left join cfg.RecordLevelAccess rla on i.CustomerID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()

	WHERE(  cfg.GetuserID() = -1 
						or Access.EntityRef is null
	) AND rla.UserID IS NULL
	AND rla.UserID IS null

	union all

	SELECT i.PurchaseInvoiceID DocumentID,
	       'VendorManager.PurchaseInvoice' EngName,
		   'Vendor' [Type],
		   i.Date,
		   0 OpeningBalance,
		   -TotalPrice SalePurchase,
		   0 Returned,
		   TotalDiscount Discount,
		   -(TotalDuty + TotalTax) Vat,
		   0 Received,
		   0 Payed,
		   i.CurrencyID,
		   P.PartyID
	FROM VND.PurchaseInvoice  i
	join cfg.Party P on P.DlID = I.DlID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE rla.UserID IS null
	union all

	SELECT i.ReturnInvoiceID DocumentID,
	       'VendorManager.ReturnInvoice' EngName,
		   'Vendor' [Type],
		   i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   TotalPrice Returned,
		   -Discount Discount,
		   (TotalDuty + TotalTax) Vat,
		   0 Received,
		   0 Payed,
		   i.CurrencyID,
		   P.PartyID
	FROM VND.ReturnInvoice  i
	join cfg.Party P on P.DlID = I.DlID
	left join (
				select ReturnInvoiceID,sum(Discount)Discount
				from vnd.ReturnInvoiceItem
				group by ReturnInvoiceID
			  )ri  on ri.ReturnInvoiceID = i.ReturnInvoiceID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE rla.UserID IS NULL

	union all			

	SELECT i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   case when RT.Type in (1,2) then 'Customer'
				else 'Vendor'
		   end [Type],
		   i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   -RS.Amount -isnull(rs.Discount,0) Received,
		   0 Payed,
		   RS.CurrencyID,
		   p.PartyID
	FROM fin.ReceiveReceipt i
	JOIN fin.ReceivedBankDraft rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
	join fin.ReceiveSubject RS on RS.ReceivedBankDraftID = rbd.ReceivedBankDraftID
	join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
	join cfg.party p on p.DlID = rs.DLID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	where RT.Type in (1,2,4)	AND rla.UserID IS NULL
	
	union all

	SELECT i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   case when RT.Type in (1,2) then 'Customer'
				else 'Vendor'
		   end [Type],
		   i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   -RS.Amount-isnull(rs.discount,0)  Received,
		   0 Payed,
		   RS.CurrencyID,
		   p.PartyID
	FROM fin.ReceiveReceipt i
	JOIN fin.ReceivedCheqe rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
	join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rbd.ReceivedCheqeID
	join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
	join cfg.party p on p.DlID = rs.DLID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE i.[Status] <> 1 and RT.Type in (1,2,4) AND rla.UserID IS null

	union all				
				
	SELECT i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   case when RT.Type in (1,2) then 'Customer'
				else 'Vendor'
		   end [Type],
		   i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   -RS.Amount-isnull(rs.discount,0)  Received,
		   0 Payed,
		   RS.CurrencyID,
		   p.PartyID
	FROM fin.ReceiveReceipt i
	JOIN fin.ReceivedCash rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
	join fin.ReceiveSubject RS on RS.ReceivedCashID = rbd.ReceivedCashID
	join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
	join cfg.party p on p.DlID = rs.DLID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	where RT.Type in (1,2,4) AND rla.UserID IS NULL

	union all

	SELECT i.ReceiptCheqeFlowID DocumentID,
	       'FinanceManager.DrawBackReceivedCheqe' EngName,
		   case when RT.Type in (1,2) then 'Customer'
				else 'Vendor'
		   end [Type],
		   i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   (RS.Amount ) Received,
		   0 Payed,
		   RS.CurrencyID,
		   P.PartyID
	FROM fin.ReceiptCheqeFlow i
	JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
	JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
	join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rc.ReceivedCheqeID
	join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
	join cfg.Party P on P.DlID = RS.DlID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE i.[Type] = 1 and  RT.Type in (1,2,4) AND rla.UserID IS NULL

	union all				

	SELECT i.ReceiptCheqeFlowID DocumentID,
	       'FinanceManager.BankOperation' EngName,
		   case when RT.Type in (1,2) then 'Customer'
				else 'Vendor'
		   end [Type],
		   i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   RS.Amount Received,
		   0 Payed,
		   RS.CurrencyID,
		   p.PartyID
	FROM fin.ReceiptCheqeFlow i
	JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
	JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
	JOIN fin.ReceiveReceipt rr ON rr.ReceiveReceiptID = rc.ReceiveReceiptID
	join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rc.ReceivedCheqeID
	join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
	join cfg.party p on p.DlID = rs.DLID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE i.[Type] = 5
	AND rcfi.[State] = 7
	AND rla.UserID IS NULL
	AND rcfi.ReceiptCheqeFlowItemID not in (select PreviousFlow 
										from fin.ReceiptCheqeFlowItem i
										join fin.ReceiptCheqeFlow h 
											on i.ReceiptCheqeFlowID = h.ReceiptCheqeFlowID
										where type = 1 )
	AND  RT.Type in (1,2,4)

	union all

	SELECT i.ReceiptCheqeFlowID DocumentID,
	       'FinanceManager.DrawBackReceivedCheqe' EngName,
		   case when PT.Type = 2 then 'Customer'
				else 'Vendor' 
		   end [Type],
	       i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   0 Received,
		   -PS.Amount Payed,
		   PS.CurrencyID,
		   P.PartyID
	FROM fin.ReceiptCheqeFlow i
	JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
	JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
	join fin.PaymentOtherCheqe POC on POC.ReceivedCheqeID = rc.ReceivedCheqeID
	join fin.PaymentSubject PS on PS.PaymentOtherCheqeID = POC.PaymentOtherCheqeID
	join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
	join cfg.Party P on P.DlID = PS.DlID and p.PartyID = i.PartyID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE i.[Type] = 4 
	and PT.Type in (1,2) AND rla.UserID IS NULL



	union all

	SELECT i.PaymentReceiptID DocumentID,
	       'FinanceManager.PaymentReceipt' EngName,
		   case when PT.Type = 2 then 'Customer'
				else 'Vendor' 
		   end [Type],
	       i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   0 Received,
		   PS.Amount  Payed,
		   PS.CurrencyID,
		   p.PartyID
	FROM fin.PaymentReceipt i
	JOIN fin.PaymentSubject PS ON PS.PaymentReceiptID = i.PaymentReceiptID
	join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
	join cfg.Party P on P.DlID = PS.DlID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE i.[Status] <> 1 and PT.Type in (1,2,10) AND rla.UserID IS NULL


	union all

	SELECT i.PaymentCheqeFlowID DocumentID,
	       'FinanceManager.DrawBackPaymentCheqe' EngName,
		   case when PT.Type = 2 then 'Customer'
				else 'Vendor'
		    end [Type],
	       i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   0 Received,
		   (-1) * PS.Amount  Payed,
		   PS.CurrencyID,
		   p.PartyID
	FROM fin.PaymentCheqeFlow i
	JOIN fin.PaymentCheqeFlowItem rbd ON rbd.PaymentCheqeFlowID = i.PaymentCheqeFlowID
	join FIN.PaymentCheqe pc on pc.PaymentCheqeID = rbd.PaymentCheqeID
	join fin.PaymentSubject PS on PS.PaymentCheqeID = PC.PaymentCheqeID
	join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
	join cfg.Party P on P.DlID = PS.DLID
	left join cfg.RecordLevelAccess rla on p.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	WHERE PT.Type in (1,2,10)
	AND I.Type = 1
	AND rla.UserID IS NULL

	union all

	SELECT i.DebitCreditNoteID DocumentID,
	       'ReportGenerator.DebitCreditNote' EngName,
		   case when rt.ReceiptTypeID is not null and rt.Type in (1,2,3) 
					then 'Customer'
				when rt.ReceiptTypeID is not null and rt.Type = 4
					then 'Vendor'
				when pt.PaymentTypeID is not null and pt.Type = 2
					then 'Customer'
				when pt.PaymentTypeID is not null and pt.Type in (1,3,10)
					then 'Vendor'
		    end [Type],
	       h.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   case when (rt.ReceiptTypeID is not null and rt.Type in (1,2,3,4))
					then (case when i.Type = 0 then i.Amount else -i.Amount end)
				else 0
					end Received,
		  case when  (pt.PaymentTypeID is not null and pt.Type in (1,2,3,10))
					 then (case when i.Type = 0 then i.Amount else -i.Amount end)
					 else 0
					 end  Payed,
		   i.CurrencyID,
		   i.PartyID
	from cfg.DebitCreditNote h
	join cfg.DebitCreditNoteItem i on h.DebitCreditNoteID = i.DebitCreditNoteID
	left join fin.ReceiptType rt on rt.ReceiptTypeID = i.ReceiptTypeID
	left join fin.PaymentType pt on pt.PaymentTypeID = i.PaymentTypeID
	left join cfg.RecordLevelAccess rla on i.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
	where 
	 rla.UserID IS NULL
	 AND (
	(rt.ReceiptTypeID is not null and rt.Type in (1,2,3,4) )
	or
		 (pt.PaymentTypeID is not null and pt.Type in (1,2,3,10)))
		 
		 


		union all


		SELECT  i.PettyCashCostID DocumentID,
	       'FinanceManager.PettyCashCost' EngName,
		   case when PT.Type = 2 then 'Customer'
				else 'Vendor' 
		   end [Type],
	       i.Date,
		   0 OpeningBalance,
		   0 SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   0 Received,
		   rcfi.Amount  Payed,
		   pc.CurrencyID,
		   rcfi.PartyID
		 FROM fin.PettyCashCost i
		 JOIN fin.PettyCashCostItem rcfi ON rcfi.PettyCashCostID = i.PettyCashCostID
		 join fin.PettyCash pc on pc.PettyCashID = i.PettyCashID
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		 left join cfg.RecordLevelAccess rla on rcfi.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
		WHERE PT.Type in (1,2,10)
		AND rla.UserID IS NULL

		union all


		SELECT  c.CostOfOrderid DocumentID,
	       'ForeignOrder.CostOfOrder' EngName,
		   'Vendor'  [Type],
	       c.Date,
		   0 OpeningBalance,
		   -i.Amount SalePurchase,
		   0 Returned,
		   0 Discount,
		   0 Vat,
		   0 Received,
		   0  Payed,
		   -1,
		   i.PartyID
		 FROM fos.CostOfOrder c
		 join fos.CostOfOrderItem i on c.CostOfOrderid = i.CostOfOrderID
		 left join cfg.RecordLevelAccess rla on i.PartyID=rla.EntityRef and rla.type=1 and  rla.userid=cfg.GetUserID()
		WHERE i.PartyID is not null
		and i.PurchaseInvoiceItemID is NULL
		AND rla.UserID IS NULL
