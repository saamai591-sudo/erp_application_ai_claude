
--------------------------------------------------------------------------
CREATE   PROC [STM].SpRptPaymentOrder
	@ID int
	as 
select  po.Number,
		u.[Name] creator,
		PO.PaymentOrderID,
		po.Date  GregorianDate,
		cfg.GetCLRSaturnDate(po.Date,'yyyy/mm/dd',0,0) ShamsiDate,
		b.Title branchtitle,
		c.Title currencytitle,
		case when po.BaseType=1 then 'آماده‌سازی پرداخت'
			 when po.BaseType=2 then 'دستور پرداخت'
			 when po.BaseType=3 then 'به تنخواه'
			 when po.BaseType=4 then 'به بانک' end as BaseType,
		a.Title bankaccounttitle,
		a.Code bankaccountcode,
		ba.AccountNo,
		pp.Number PayPreparingNumber,
		ppr.Title PayrollPaymentType,
		poi.ExchangeRate,
		poi.Price,
		p.Title + ' ' +ISNULL(p.LastName,'') recievertitle,
		cp.Title pettypartytitle,
		f.Title fundtitle,
		cp.CustomerCode pettycode,
		cpr.title + ' '+ ISNULL(cpr.LastName,'') paymentrequestparty,
		adl.Title RecieverBank,
		acdl.Title paymentrequesttitle,
		poi.Description,
		poi.Description2
from req.PaymentOrder po
left join cfg.[User] u on u.userid=po.Creator
		left join cfg.Branch b on po.BranchID = b.BranchID
		left join cfg.Currency c on c.CurrencyID=po.PaymentCurrencyID
		left join cfg.BankAccount ba on ba.BankAccountID=po.BankAccountID
		left join acc.DL a on a.DLID = ba.DlID
		left join req.PaymentOrderItem poi on po.PaymentOrderID = poi.PaymentOrderID
		left join cfg.BankAccount bac on bac.BankAccountID=poi.BankAccountID
		left join acc.dl adl on adl.DLID=bac.DlID
		left join cfg.Party p on p.partyid=poi.ReceiverID
		left join fin.PettyCash pc on pc.PettyCashID=poi.PettyCashID
		left join fin.fund f on f.FundID= pc.FundID
		left join cfg.party cp on cp.PartyID=pc.PartyID
		left join pay.PayPreparing pp on pp.PayPreparingID=poi.PayPreparingID
		left join pay.PayrollPaymentType ppr on ppr.PayrollPaymentTypeID=pp.PayrollPaymentTypeID
		left join req.PaymentRequestItem pri on pri.PaymentRequestItemID=poi.PaymentRequestItemID
		left join cfg.Party cpr on cpr.PartyID = pri.PartyID
		left join acc.DL acdl on acdl.DLID= cpr.DlID
	

	
	where po.PaymentOrderID = @ID
