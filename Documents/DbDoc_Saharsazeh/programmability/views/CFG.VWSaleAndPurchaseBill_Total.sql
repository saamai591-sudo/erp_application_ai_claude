
--------------------------------------------------------------------------
CREATE    view CFG.VWSaleAndPurchaseBill_Total
--WITH ENCRYPTION 
AS

		SELECT  i.CustomerOpeningBalanceID DocumentID,
	            'SaleManager.CustomerOpeningBalance' EngName,
		        'Customer' [Type],
				f.StartDate [Date],
				N'مانده اول دوره مشتری' [Description],
				null [Number],
				case when i.BalanceType=0 then i.OpeningBalance else 0 end [Debit],
				case when i.BalanceType=0 then 0 else i.OpeningBalance  end [Credit],
				c.Title,
				i.CurrencyID,
				f.FinancialPeriodID,
				I.CustomerID PartyID,
				'SLE' [Schema],
				0 Periority
		 FROM SLE.CustomerOpeningBalance i
		JOIN cfg.Currency c ON c.CurrencyID = i.CurrencyID
		join CFG.FinancialPeriod f on f.FinancialPeriodID = i.FinancialPeriodID

		union all

		SELECT  i.VendorOpeningBalanceID DocumentID,
	            'VendorManager.VendorOpeningBalance' EngName,
				'Vendor' [Type],
				f.StartDate [Date],
				N'مانده اول دوره تامین کننده' [Description],
				null [Number],
				case when i.BalanceType=0 then i.OpeningBalance else 0 end [Debit],
				case when i.BalanceType=0 then 0 else i.OpeningBalance  end [Credit],
				c.Title,
				i.CurrencyID,
				f.FinancialPeriodID,
				I.VendorID PartyID,
				'VND' [Schema],
				1 Periority
		 FROM vnd.VendorOpeningBalance  i
		JOIN cfg.Currency c ON c.CurrencyID = i.CurrencyID
		join CFG.FinancialPeriod f on f.FinancialPeriodID = i.FinancialPeriodID

		union all

		SELECT  i.InvoiceID DocumentID,
	            'SaleManager.Invoice' EngName,
		        'Customer' [Type],
				i.Date,
				N'فاکتور فروش' [Description],
				i.Number,
				i.TotalNetPrice [Debit],
				0 [Credit],
				c.Title,
				i.CurrencyID,
				FinancialPeriodID,
				I.CustomerID PartyID,
				'SLE' [Schema],
				2 Periority
		 FROM sle.Invoice i
		JOIN cfg.Currency c ON c.CurrencyID = i.CurrencyID
		WHERE i.SaleInvoiceStatus <> 2
		and( (select lower(ConfigValue) from CFG.Configuration
		where ConfigKey = 'InvoiceNeedConfirm') = 'false'
			or
			i.SaleInvoiceStatus=3)

			
		union	all

		SELECT  i.ReturnedSaleInvoiceID DocumentID,
	            'SaleManager.ReturnedSaleInvoice' EngName,
				'Customer' [Type],
				i.Date,
				N'برگشت فروش' [Description],
				i.Number,
				0 [Debit],
				i.TotalNetPrice [Credit],
				c.Title,
				i.CurrencyID,
				FinancialPeriodID,
				I.CustomerID PartyID,
				'SLE' [Schema],
				3 Periority
		 FROM sle.ReturnedSaleInvoice i
		JOIN cfg.Currency c ON c.CurrencyID = i.CurrencyID

		union all
		

		SELECT  i.PurchaseInvoiceID DocumentID,
	            'VendorManager.PurchaseInvoice' EngName,
				'Vendor' [Type],
				i.Date,
				N'خرید طی فاکتور شماره '+isnull(i.InvoiceNumber, i.Number)+N' به تاریخ '+cfg.GetCLRSaturnDate(isnull(i.InvoiceDate,i.Date),'YYYY/MM/DD',0,0) [Description],
				i.Number,
				0 [Debit],
				i.TotalNetPrice [Credit],
				c.Title,
				i.CurrencyID,
				FinancialPeriodID,
				P.PartyID,
				'VND' [Schema],
				4 Periority
		 FROM vnd.PurchaseInvoice  i
		JOIN cfg.Currency c ON c.CurrencyID = i.CurrencyID
		join cfg.Party P on P.DlID = I.DlID

		union all

		SELECT  i.ReturnInvoiceID DocumentID,
	       'VendorManager.ReturnInvoice' EngName,
		   'Vendor' [Type],
				i.Date,
				N'برگشت خرید',
				i.Number,
				i.TotalNetPrice [Debit],
				0 [Credit],
				c.Title,
				i.CurrencyID,
				FinancialPeriodID,
				P.PartyID,
				'VND' [Schema],
				5 Periority
		 FROM vnd.ReturnInvoice  i
		JOIN cfg.Currency c ON c.CurrencyID = i.CurrencyID
		join cfg.Party P on P.DlID = I.DlID

		union all
	
		SELECT  i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'حواله بانکی به شماره '+ CAST(rbd.Number AS NVARCHAR(100))+N'نزد '+ CAST(d.Title AS NVARCHAR(250))
				+case when s.invoiceid is not null then N' بابت فاکتور فروش شماره '+CAST(s.Number AS NVARCHAR(250)) else '' end,
				i.Number,
				0 [Debit],
				rs.Amount-rs.Discount [Credit],
				c.Title,
				rs.CurrencyID,
				i.FinancialPeriodID,
				p1.PartyID,
				'FIN' [Schema],
				6 Periority
		 FROM fin.ReceiveReceipt i
		 JOIN fin.ReceivedBankDraft rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
		 JOIN cfg.Currency c ON c.CurrencyID = rbd.CurrencyID
		 JOIN cfg.BankAccount ba ON ba.BankAccountID = rbd.BankAccountID
		 JOIN acc.DL d ON d.DLID = ba.DlID
		 join fin.ReceiveSubject RS on RS.ReceivedBankDraftID = rbd.ReceivedBankDraftID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		 join cfg.Party p1 on p1.DlID = rs.DLID
		 left join sle.invoice s on s.invoiceid = rs.InvoiceID

		 where RT.Type in (1,2,4)

		union all
			
		SELECT  i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'دریافت چک به شماره '+ CAST(rbd.Number AS NVARCHAR(100))+N'بانک '+ CAST(b.Title AS NVARCHAR(250))				
				+case when s.invoiceid is not null then N' بابت فاکتور فروش شماره '+CAST(s.Number AS NVARCHAR(250)) else '' end,
				i.Number,
				0 [Debit],
				rs.Amount-rs.Discount [Credit],
				c.Title,
				rs.CurrencyID,
				i.FinancialPeriodID,
				p1.PartyID,
				'FIN' [Schema],
				7 Periority
		 FROM fin.ReceiveReceipt i
		 JOIN fin.ReceivedCheqe rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
		 JOIN cfg.Currency c ON c.CurrencyID = rbd.CurrencyID
		 JOIN cfg.Bank b ON b.BankID = rbd.BankID
		 join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rbd.ReceivedCheqeID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		 join cfg.Party p1 on p1.DlID = rs.DLID
		 left join sle.invoice s on s.invoiceid = rs.InvoiceID
		WHERE i.[Status] <> 1 and RT.Type in (1,2,4)
	
		union all

		SELECT  i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'دریافت نقدی '
					+ case when s.invoiceid is not null then N' بابت فاکتور فروش شماره '+CAST(s.Number AS NVARCHAR(250)) else '' end,
				i.Number,
				0 [Debit],
				rs.Amount-rs.Discount [Credit],
				c.Title,
				rs.CurrencyID,
				i.FinancialPeriodID,
				p1.PartyID,
				'FIN' [Schema],
				8 Periority
		 FROM fin.ReceiveReceipt i
		 JOIN fin.ReceivedCash rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
		 JOIN cfg.Currency c ON c.CurrencyID = rbd.CurrencyID
		 join fin.ReceiveSubject RS on RS.ReceivedCashID = rbd.ReceivedCashID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		 join cfg.Party p1 on p1.DlID = rs.DLID
		 left join sle.invoice s on s.invoiceid = rs.InvoiceID
		 where RT.Type in (1,2,4)

		union all

		SELECT  i.ReceiptCheqeFlowID DocumentID,
	       'FinanceManager.DrawBackReceivedCheqe' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'استرداد چک دریافتی به شماره ' + CAST(rc.Number AS NVARCHAR(100)),
				i.Number,
				rs.Amount-rs.Discount [Debit],
				0 [Credit],
				c.Title,
				rs.CurrencyID,
				FinancialPeriodID,
				P.PartyID,
				'FIN' [Schema],
				9 Periority
		 FROM fin.ReceiptCheqeFlow i
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 JOIN cfg.Currency c ON c.CurrencyID = rc.CurrencyID
		 join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
 		 join cfg.Party P on P.DlID = RS.DlID
		WHERE i.[Type] = 1 and  RT.Type in (1,2,4)
		
		union all

		SELECT  i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   'Customer' [Type],
				i.Date,
				N'تخفیف نقدی فروش' ,
				i.Number,
				0 [Debit],
				rcfi.Discount [Credit],
				c.Title,
				rcfi.CurrencyID,
				FinancialPeriodID,
				P.PartyID,
				'FIN' [Schema],
				10 Periority
		 FROM fin.ReceiveReceipt i
		 JOIN fin.ReceiveSubject rcfi ON rcfi.ReceiveReceiptID = i.ReceiveReceiptID
		 JOIN cfg.Currency c ON c.CurrencyID = rcfi.CurrencyID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = rcfi.ReceiptTypeID
		join cfg.Party P on P.DlID = rcfi.DlID
		WHERE rcfi.Discount	> 0  and  RT.Type in (1,2,4)
		
		union all

		SELECT   i.ReceiptCheqeFlowID DocumentID,
	       'FinanceManager.DrawBackReceivedCheqe' EngName,
		   case when PT.Type = 2 then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'برگشت خرج چک به شماره ' + CAST(rc.Number AS NVARCHAR(100)),
				NULL [Number],
				0 [Debit],
				ps.Amount-ps.Discount [Credit],
				c.Title,
				rc.CurrencyID,
				FinancialPeriodID,
				P.PartyID,
				'FIN' [Schema],
				11 Periority
		 FROM fin.ReceiptCheqeFlow i
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 JOIN cfg.Currency c ON c.CurrencyID = rc.CurrencyID
		 join fin.PaymentOtherCheqe POC on POC.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.PaymentSubject PS on PS.PaymentOtherCheqeID = POC.PaymentOtherCheqeID
		 join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
		join cfg.Party P on P.DlID = PS.DlID and p.PartyID = i.PartyID
		WHERE i.[Type] = 4
		and PT.Type in (1,2)
		
		union all

		SELECT  i.ReceiptCheqeFlowID DocumentID,
	       'FinanceManager.BankOperation' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'واخواست چک به شماره ' + CAST(rc.Number AS NVARCHAR(100)),
				NULL,
				rs.Amount-rs.Discount [Debit],
				0 [Credit],
				c.Title,
				rc.CurrencyID,
				i.FinancialPeriodID,
				p1.PartyID,
				'FIN' [Schema],
				12 Periority
		 FROM fin.ReceiptCheqeFlow i
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 JOIN cfg.Currency c ON c.CurrencyID = rc.CurrencyID
		 join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		 join cfg.Party p1 on p1.DlID = rs.DLID
		WHERE i.[Type] = 5
		AND rcfi.[State] = 7
		AND rcfi.ReceiptCheqeFlowItemID not in (select PreviousFlow 
												from fin.ReceiptCheqeFlowItem i
												join fin.ReceiptCheqeFlow h 
													on i.ReceiptCheqeFlowID = h.ReceiptCheqeFlowID
												where type = 1 )
		AND  RT.Type in (1,2,4)
		
		union all

		SELECT  i.PaymentReceiptID DocumentID,
	       'FinanceManager.PaymentReceipt' EngName,
		   case when PT.Type = 2 then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				case when pi.Number is not null then N'پرداخت بابت فاکتور شماره '+cast(pi.Number as varchar(50))
					 when pt.Type =10 then N'پیش پرداخت' else N'پرداخت' end,
				i.Number,
				rcfi.Amount - rcfi.Discount,
				0,
				c.Title,
				rcfi.CurrencyID,
				i.FinancialPeriodID,
				p1.PartyID,
				'FIN' [Schema],
				13 Periority
		 FROM fin.PaymentReceipt i
		 JOIN fin.PaymentSubject rcfi ON rcfi.PaymentReceiptID = i.PaymentReceiptID
		 JOIN cfg.Currency c ON c.CurrencyID = rcfi.CurrencyID
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		 join cfg.Party p1 on p1.DlID = rcfi.DLID
		 left join vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = rcfi.PurchaseInvoiceID
		WHERE i.[Status] <> 1
		and PT.Type in (1,2,10)
	
		union all

		SELECT  i.PaymentReceiptID DocumentID,
	       'FinanceManager.PaymentReceipt' EngName,
		   'Vendor' [Type],
				i.Date,
				N'تخفیف نقدی خرید' ,
				i.Number,
				rcfi.Discount,
				0,
				c.Title,
				rcfi.CurrencyID,
				FinancialPeriodID,
				p1.PartyID,
				'FIN' [Schema],
				14 Periority
		 FROM fin.PaymentReceipt i
		 JOIN fin.PaymentSubject rcfi ON rcfi.PaymentReceiptID = i.PaymentReceiptID
		 JOIN cfg.Currency c ON c.CurrencyID = rcfi.CurrencyID
		 join cfg.Party p1 on p1.DlID = rcfi.DLID
		WHERE rcfi.Discount	>0
		
		union all
	

		SELECT  i.PaymentCheqeFlowID DocumentID,
	       'FinanceManager.DrawBackPaymentCheqe' EngName,
		   case when PT.Type = 2 then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'استرداد چک پرداختی',
				null,
				0,
				PS.Amount - PS.Discount ,
				c.Title,
				ps.CurrencyID,
				FinancialPeriodID,
				p.PartyID,
				'FIN' [Schema],
				15 Periority
		 FROM fin.PaymentCheqeFlow i
		 JOIN fin.PaymentCheqeFlowItem rbd ON rbd.PaymentCheqeFlowID = i.PaymentCheqeFlowID
		 join FIN.PaymentCheqe pc on pc.PaymentCheqeID = rbd.PaymentCheqeID
		 JOIN cfg.Currency c ON c.CurrencyID = pc.CurrencyID 		 
		 join fin.PaymentSubject PS on PS.PaymentCheqeID = PC.PaymentCheqeID
		 join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
		 join cfg.Party P on P.DlID = PS.DLID
		WHERE PT.Type in (1,2,10)
		AND I.Type = 1
		
		union all

	SELECT h.DebitCreditNoteID DocumentID,
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
		   case when i.description is not null then i.Description else N'اعلامیه بدهکار بستانکار به شماره ' + CAST(h.Number as varchar(250)) end,		      
		   h.Number,
		   case when i.type = 0 then i.amount - i.Discount else 0 end,
		   case when i.type = 1 then i.amount - i.Discount else 0 end,
		   c.Title,
		   c.CurrencyID,
		   FinancialPeriodID,
		   p.PartyID,
		   'FIN' [Schema]	,
		   16 Periority

	from cfg.DebitCreditNote h
	join cfg.DebitCreditNoteItem i on h.DebitCreditNoteID = i.DebitCreditNoteID
	join cfg.currency c on c.currencyid = i.currencyid
	join cfg.party p on p.PartyID = i.PartyID
	left join fin.ReceiptType rt on rt.ReceiptTypeID = i.ReceiptTypeID
	left join fin.PaymentType pt on pt.PaymentTypeID = i.PaymentTypeID
	where (rt.ReceiptTypeID is not null and rt.Type in (1,2,3,4) )
	or
		 (pt.PaymentTypeID is not null and pt.Type in (1,2,3,10))

		 		
		union all

	SELECT h.DebitCreditNoteID DocumentID,
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
		   case when i.description is not null then i.Description else N'تخفیف در اعلامیه بدهکار بستانکار به شماره ' + CAST(h.Number as varchar(250)) end,		   
		   h.Number,
		   case when i.type = 1 then i.Discount else 0 end,
		   case when i.type = 0 then i.Discount else 0 end,
		   c.Title,
		   c.CurrencyID,
		   FinancialPeriodID,
		   p.PartyID,
		   'FIN' [Schema]	,
		   17 Periority

	from cfg.DebitCreditNote h
	join cfg.DebitCreditNoteItem i on h.DebitCreditNoteID = i.DebitCreditNoteID
	join cfg.currency c on c.currencyid = i.currencyid
	join cfg.party p on p.PartyID = i.PartyID
	left join fin.ReceiptType rt on rt.ReceiptTypeID = i.ReceiptTypeID
	left join fin.PaymentType pt on pt.PaymentTypeID = i.PaymentTypeID
	where( (rt.ReceiptTypeID is not null and rt.Type in (1,2,3,4) )
	or
		 (pt.PaymentTypeID is not null and pt.Type in (1,2,3,10)))
		 and i.Discount > 0

		union all

		SELECT  i.PettyCashCostID DocumentID,
	       'FinanceManager.PettyCashCost' EngName,
		   case when PT.Type = 2 then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				case when pi.Number is not null then N'پرداخت از تنخواه بابت فاکتور شماره '+cast(pi.Number as varchar(50))
					 when pt.Type =10 then N' پیش پرداخت از تنخواه' else N'پرداخت از تنخواه' end,
				i.Number,
				rcfi.Amount ,
				0,
				c.Title,
				c.CurrencyID,
				i.FinancialPeriodID,
				p1.PartyID,
				'FIN' [Schema],
				13 Periority
		 FROM fin.PettyCashCost i
		 JOIN fin.PettyCashCostItem rcfi ON rcfi.PettyCashCostID = i.PettyCashCostID
		 join fin.PettyCash pc on pc.PettyCashID = i.PettyCashID
		 JOIN cfg.Currency c ON c.CurrencyID = pc.CurrencyID
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		 join cfg.Party p1 on p1.PartyID = rcfi.PartyID
		 left join vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = rcfi.PurchaseInvoiceID
		WHERE PT.Type in (1,2,10)

		union all

		SELECT  c.CostOfOrderid DocumentID,
	       'ForeignOrder.CostOfOrder' EngName,
		   'Vendor'  [Type],
				c.Date,
				s.Title,
				c.Number,
				0,
				i.Amount ,
				(select top 1 title from cfg.currency where currencyid = -1),
				-1,
				c.FinancialPeriodID,
				i.PartyID,
				'FOS' [Schema],
				14 Periority
		 FROM fos.CostOfOrder c
		 join fos.CostOfOrderItem i on c.CostOfOrderid = i.CostOfOrderID
		 join fos.SpecialCost s on s.SpecialCostID = i.SpecialCostID
		WHERE i.PartyID is not null
		and i.PurchaseInvoiceItemID is null
