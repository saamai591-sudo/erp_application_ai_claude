
--------------------------------------------------------------------------
CREATE    view CFG.VWSaleAndPurchaseBill_Detail

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
				i.CurrencyID,
				I.CustomerID PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat

		 FROM sle.CustomerOpeningBalance i
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
				i.CurrencyID,
				I.VendorID PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM vnd.VendorOpeningBalance  i
		join CFG.FinancialPeriod f on f.FinancialPeriodID = i.FinancialPeriodID

		union all

		SELECT  i.InvoiceID DocumentID,
	       'SaleManager.Invoice' EngName,
		   'Customer' [Type],
				i.Date,
				s.Title [Description],
				i.Number,
				vi.Price - vi.Discount [Debit],
				0 [Credit],
				i.CurrencyID,
				I.CustomerID PartyID,
				s.Code StuffCode,
				s.Title StuffTitle,
				vi.MainQuantity MainQuantity,
				vi.Fee Fee,
				vi.Price Price,
				vi.Discount Discount,
				vi.tax + vi.Duty Vat
		 FROM sle.Invoice i
		 JOIN sle.InvoiceItem Vi on Vi.InvoiceID = i.InvoiceID
		 JOIN stf.stuff s on s.StuffID = vi.StuffID
		WHERE i.SaleInvoiceStatus <> 2
		and( (select lower(ConfigValue) from CFG.Configuration
		where ConfigKey = 'InvoiceNeedConfirm') = 'false'
			or
			i.SaleInvoiceStatus=3)

			
		union all	

		SELECT  i.ReturnedSaleInvoiceID DocumentID,
	       'SaleManager.ReturnedSaleInvoice' EngName,
		    'Customer' [Type],
				i.Date,
				s.Title [Description],
				i.Number,
				0 [Debit],
				vi.Price - vi.Discount [Credit],
				i.CurrencyID,
				I.CustomerID PartyID,
				s.Code StuffCode,
				s.Title StuffTitle,
				vi.MainQuantity MainQuantity,
				vi.Fee Fee,
				vi.Price Price,
				vi.Discount Discount,
				vi.tax + vi.Duty Vat
		 FROM sle.ReturnedSaleInvoice i
		 join sle.ReturnedSaleInvoiceItem Vi on vi.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
		 join stf.stuff s on s.StuffID = vi.StuffID

		union all
		

		SELECT  i.PurchaseInvoiceID DocumentID,
	       'VendorManager.PurchaseInvoice' EngName,
		   'Vendor' [Type],
				i.Date,
				s.Title [Description],
				i.Number,
				0 [Debit],
				ii.Price - ii.Discount [Credit],
				i.CurrencyID,
				P.PartyID,
				s.Code StuffCode,
				s.Title StuffTitle,
				ii.MainQuantity MainQuantity,
				ii.Fee Fee,
				ii.Price Price,
				ii.Discount Discount,
				ii.tax + ii.Duty Vat
		 FROM vnd.PurchaseInvoice  i
		 join vnd.PurchaseInvoiceItem ii on ii.PurchaseInvoiceID = i.PurchaseInvoiceID
		 join stf.stuff s on s.StuffID = ii.StuffID
		join cfg.Party P on P.DlID = I.DlID

		union all

		SELECT i.ReturnInvoiceID DocumentID,
	       'VendorManager.ReturnInvoice' EngName,
		    'Vendor' [Type],
				i.Date,
				s.Title,
				i.Number,
				ii.Price - ii.Discount [Debit],
				0 [Credit],
				i.CurrencyID,
				P.PartyID,
				s.Code StuffCode,
				s.Title StuffTitle,
				ii.MainQuantity MainQuantity,
				ii.Fee Fee,
				ii.Price Price,
				ii.Discount Discount,
				ii.tax + ii.Duty Vat
		 FROM vnd.ReturnInvoice  i
		 join vnd.ReturnInvoiceItem ii on i.ReturnInvoiceID = ii.ReturnInvoiceID
		 join stf.stuff s on s.stuffid = ii.StuffID
		join cfg.Party P on P.DlID = I.DlID

		union all
	
		SELECT  i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'حواله بانکی به شماره '+ CAST(rbd.Number AS NVARCHAR(100))+N'نزد '+ CAST(d.Title AS NVARCHAR(250)),
				i.Number,
				0 [Debit],
				rs.Amount-rs.Discount [Credit],
				rs.CurrencyID,
				i.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.ReceiveReceipt i
		 JOIN fin.ReceivedBankDraft rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
		 JOIN cfg.BankAccount ba ON ba.BankAccountID = rbd.BankAccountID
		 JOIN acc.DL d ON d.DLID = ba.DlID
		 join fin.ReceiveSubject RS on RS.ReceivedBankDraftID = rbd.ReceivedBankDraftID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		 where RT.Type in (1,2,4)

		union all
			
		SELECT  i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'دریافت چک به شماره'+ CAST(rbd.Number AS NVARCHAR(100))+N'بانک '+ CAST(b.Title AS NVARCHAR(250)),
				i.Number,
				0 [Debit],
				rs.Amount - rs.Discount [Credit],
				rs.CurrencyID,
				i.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.ReceiveReceipt i
		 JOIN fin.ReceivedCheqe rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
		 JOIN cfg.Bank b ON b.BankID = rbd.BankID
		 join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rbd.ReceivedCheqeID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		WHERE i.[Status] <> 1 and RT.Type in (1,2,4)
	
		union all

		SELECT  i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'دریافت نقدی',
				i.Number,
				0 [Debit],
				rs.Amount - rs.Discount [Credit],
				rs.CurrencyID,
				i.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.ReceiveReceipt i
		 JOIN fin.ReceivedCash rbd ON rbd.ReceiveReceiptID = i.ReceiveReceiptID
		 join fin.ReceiveSubject RS on RS.ReceivedCashID = rbd.ReceivedCashID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		 where RT.Type in (1,2,4)

		union all

		SELECT  i.ReceiptCheqeFlowID DocumentID,
	       'FinanceManager.DrawBackReceivedCheqe' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'استرداد چک دریافتی به شماره ' + CAST(rc.Number AS NVARCHAR(100)),
				i.Number,
				rs.Amount - rs.Discount [Debit],
				0 [Credit],
				rs.CurrencyID,
				P.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.ReceiptCheqeFlow i
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
		join cfg.Party P on P.DlID = RS.DlID
		WHERE i.[Type] = 1 and  RT.Type in (1,2,4)
		
		union all

		SELECT   i.ReceiveReceiptID DocumentID,
	       'FinanceManager.ReceiveReceipt' EngName,
		   'Customer' [Type],
				i.Date,
				N'تخفیف نقدی فروش' ,
				i.Number,
				0 [Debit],
				rcfi.Discount [Credit],
				rcfi.CurrencyID,
				P.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.ReceiveReceipt i
		 JOIN fin.ReceiveSubject rcfi ON rcfi.ReceiveReceiptID = i.ReceiveReceiptID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = rcfi.ReceiptTypeID
		join cfg.Party P on P.DlID = rcfi.DlID
		WHERE rcfi.Discount	> 0  and  RT.Type in (1,2,4)
		
		union all

		SELECT  i.ReceiptCheqeFlowID DocumentID,
	       'FinanceManager.DrawBackReceivedCheqe' EngName,
		   case when PT.Type = 2 then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'برگشت خرج چک به شماره ' + CAST(rc.Number AS NVARCHAR(100)),
				NULL [Number],
				0 [Debit],
				PS.Amount - PS.Discount [Credit],
				PS.CurrencyID,
				P.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.ReceiptCheqeFlow i
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.PaymentOtherCheqe POC on POC.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.PaymentSubject PS on PS.PaymentOtherCheqeID = POC.PaymentOtherCheqeID
		 join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
		join cfg.Party P on P.DlID = PS.DlID
		WHERE i.[Type] = 4
		and PT.Type in (1,2)
		
		union all

		SELECT   i.ReceiptCheqeFlowID DocumentID,
	       'FinanceManager.BankOperation' EngName,
		   case when RT.Type in (1,2) then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'واخواست چک به شماره ' + CAST(rc.Number AS NVARCHAR(100)),
				NULL,
				RS.Amount - RS.Discount [Debit],
				0 [Credit],
				RS.CurrencyID,
				rr.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.ReceiptCheqeFlow i
		 JOIN fin.ReceiptCheqeFlowItem rcfi ON rcfi.ReceiptCheqeFlowID = i.ReceiptCheqeFlowID
		 JOIN fin.ReceivedCheqe rc ON rcfi.ReceivedCheqeID = rc.ReceivedCheqeID
		 JOIN fin.ReceiveReceipt rr ON rr.ReceiveReceiptID = rc.ReceiveReceiptID
		 join fin.ReceiveSubject RS on RS.ReceivedCheqeID = rc.ReceivedCheqeID
		 join fin.ReceiptType RT on RT.ReceiptTypeID = RS.ReceiptTypeID
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
				N'پرداخت',
				i.Number,
				rcfi.Amount,
				0,
				rcfi.CurrencyID,
				i.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.PaymentReceipt i
		 JOIN fin.PaymentSubject rcfi ON rcfi.PaymentReceiptID = i.PaymentReceiptID
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		WHERE i.[Status] <> 1
		and PT.Type in (1,2)
	
		union all

		SELECT  i.PaymentReceiptID DocumentID,
	       'FinanceManager.PaymentReceipt' EngName,
		   'Vendor' [Type],
				i.Date,
				N'تخفیف نقدی خرید' ,
				i.Number,
				rcfi.Discount,
				0,
				rcfi.CurrencyID,
				i.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.PaymentReceipt i
		 JOIN fin.PaymentSubject rcfi ON rcfi.PaymentReceiptID = i.PaymentReceiptID
		WHERE rcfi.Discount	>0
		
		union all
	

		SELECT i.PaymentCheqeFlowID DocumentID,
	       'FinanceManager.DrawBackPaymentCheqe' EngName,
		    case when PT.Type = 2 then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'استرداد چک پرداختی',
				null,
				0,
				PS.Amount - PS.Discount,
				PS.CurrencyID,
				p.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.PaymentCheqeFlow i
		 JOIN fin.PaymentCheqeFlowItem rbd ON rbd.PaymentCheqeFlowID = i.PaymentCheqeFlowID
		 join FIN.PaymentCheqe pc on pc.PaymentCheqeID = rbd.PaymentCheqeID
		 join fin.PaymentSubject PS on PS.PaymentCheqeID = PC.PaymentCheqeID
		 join fin.PaymentType PT on PT.PaymentTypeID = PS.PaymentTypeID
		 join cfg.Party P on P.DlID = PS.DLID and p.PartyID = i.PartyID
		WHERE PT.Type in (1,2)
		
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
			    i.description,
			    h.Number,
			    case when i.type = 0 then i.amount - i.Discount else 0 end,
			    case when i.type = 1 then i.amount - i.Discount else 0 end,
			    i.CurrencyID,
			    p.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat

	from cfg.DebitCreditNote h
	join cfg.DebitCreditNoteItem i on h.DebitCreditNoteID = i.DebitCreditNoteID
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
				i.description,		   
				h.Number,
				case when i.type = 1 then  i.Discount else 0 end,
				case when i.type = 0 then  i.Discount else 0 end,
				i.CurrencyID,
				p.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat

	from cfg.DebitCreditNote h
	join cfg.DebitCreditNoteItem i on h.DebitCreditNoteID = i.DebitCreditNoteID
	join cfg.party p on p.PartyID = i.PartyID
	left join fin.ReceiptType rt on rt.ReceiptTypeID = i.ReceiptTypeID
	left join fin.PaymentType pt on pt.PaymentTypeID = i.PaymentTypeID
	where ((rt.ReceiptTypeID is not null and rt.Type in (1,2,3,4) )
	or
		 (pt.PaymentTypeID is not null and pt.Type in (1,2,3,10)))
		 and i.Discount > 0

		union all

		SELECT  i.PettyCashCostID DocumentID,
	       'FinanceManager.PettyCashCost' EngName,
		   case when PT.Type = 2 then 'Customer'
					else 'Vendor' end [Type],
				i.Date,
				N'پرداخت از تنخواه',
				i.Number,
				rcfi.Amount,
				0,
				pc.CurrencyID,
				rcfi.PartyID,
				null StuffCode,
				null StuffTitle,
				null MainQuantity,
				null Fee,
				null Price,
				null Discount,
				null Vat
		 FROM fin.PettyCashCost i
		 JOIN fin.PettyCashCostItem rcfi ON rcfi.PettyCashCostID = i.PettyCashCostID
		 join fin.PettyCash pc on pc.PettyCashID = i.PettyCashID
		 JOIN cfg.Currency c ON c.CurrencyID = pc.CurrencyID
		 join fin.PaymentType PT on PT.PaymentTypeID = rcfi.PaymentTypeID
		WHERE PT.Type in (1,2,10)

		union all

		SELECT  c.CostOfOrderid DocumentID,
	       'ForeignOrder.CostOfOrder' EngName,
		   'Vendor'  [Type],
				c.Date,
				N'هزینه سفارش',
				c.Number,
				i.Amount,
				0,
				-1,
				i.PartyID,
				null StuffCode,
				s.Title StuffTitle,
				null MainQuantity,
				null Fee,
				i.Amount Price,
				null Discount,
				null Vat
		 FROM fos.CostOfOrder c
		 join fos.CostOfOrderItem i on c.CostOfOrderid = i.CostOfOrderID
		 join fos.SpecialCost s on s.SpecialCostID = i.SpecialCostID
		WHERE i.PartyID is not null
		and i.PurchaseInvoiceItemID is null
