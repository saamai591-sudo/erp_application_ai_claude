
------------------------------------------------
CREATE   PROC [FIN].GetCustomerRemainAccount
    (
      @FinancialPeriod INT ,
      @CustomerID INT ,
      @InvoiceID INT ,
	  @PosInvoiceId INT,
      @Remain DECIMAL(30, 4) OUTPUT
    )
--WITH ENCRYPTION
AS
	IF OBJECT_ID('tempdb..#inBaseCurrencies') IS Not NULL
		DROP TABLE #inBaseCurrencies

create table #inBaseCurrencies (AmountInBaseCurrency decimal(30, 4))

	insert into #inBaseCurrencies
	   select isnull(sum(a.OpeningBalanceInBaseCurrency),0) from (
		    SELECT case when c.IsBaseCurrencyBasis = 0 then
							round(b.OpeningBalance * b.CurrencyRate / c.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
						when c.IsBaseCurrencyBasis = 1 then
							round(b.OpeningBalance * c.ExchangeUnit / b.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]())
				   end as OpeningBalanceInBaseCurrency 

			FROM     SLE.CustomerOpeningBalance b
			join     CFG.Currency c on b.CurrencyID = c.CurrencyID			
			WHERE    FinancialPeriodID = @FinancialPeriod
					 AND CustomerID = @CustomerID
					 AND BalanceType = 0) a


	insert into #inBaseCurrencies
	   select isnull(sum(-a.OpeningBalanceInBaseCurrency),0) from (
		    SELECT case when c.IsBaseCurrencyBasis = 0 then
							round(b.OpeningBalance * b.CurrencyRate / c.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
						when c.IsBaseCurrencyBasis = 1 then
							round(b.OpeningBalance * c.ExchangeUnit / b.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]())
				   end as OpeningBalanceInBaseCurrency 

			FROM     SLE.CustomerOpeningBalance b
			join     CFG.Currency c on b.CurrencyID = c.CurrencyID			
			WHERE    FinancialPeriodID = @FinancialPeriod
					 AND CustomerID = @CustomerID
					 AND BalanceType = 1) a


	insert into #inBaseCurrencies
		select isnull(sum(a.TotalNetPriceInBaseCurrency),0) from (
		    SELECT  case when c.IsBaseCurrencyBasis = 0 then
							round(i.TotalNetPrice * i.CurrencyRate / c.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
						when c.IsBaseCurrencyBasis = 1 then
							round(i.TotalNetPrice * c.ExchangeUnit / i.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]())
					end as TotalNetPriceInBaseCurrency 

			FROM     SLE.Invoice i
			join     CFG.Currency c on i.CurrencyID = c.CurrencyID						
			WHERE    FinancialPeriodID = @FinancialPeriod
					 AND SaleInvoiceStatus <> 5
                     AND ( @InvoiceID IS NULL OR InvoiceID <> @InvoiceID)
                     AND CustomerID = @CustomerID) a


	insert into #inBaseCurrencies
		select isnull(sum(-a.TotalNetPriceInBaseCurrency),0) from (
		    SELECT  case when c.IsBaseCurrencyBasis = 0 then
							round(i.TotalNetPrice * i.CurrencyRate / c.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
						when c.IsBaseCurrencyBasis = 1 then
							round(i.TotalNetPrice * c.ExchangeUnit / i.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]())
					end as TotalNetPriceInBaseCurrency 

			FROM     SLE.ReturnedSaleInvoice i
			join     CFG.Currency c on i.CurrencyID = c.CurrencyID						
			WHERE    FinancialPeriodID = @FinancialPeriod
                     AND Status <> 2
                     AND CustomerID = @CustomerID) a


	insert into #inBaseCurrencies
		select isnull(sum(-a.AmountInBaseCurrency),0) from (
			select case when c.IsBaseCurrencyBasis = 0 then
							round(s.Amount * s.CurrencyRate / c.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
						when c.IsBaseCurrencyBasis = 1 then
							round(s.Amount * c.ExchangeUnit / s.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]())
					end as AmountInBaseCurrency 

			from FIN.ReceiveSubject s
			join FIN.ReceiveReceipt r on s.ReceiveReceiptID = r.ReceiveReceiptID
			join FIN.ReceiptType t on s.ReceiptTypeID = t.ReceiptTypeID
			join CFG.Currency c on s.CurrencyID = c.CurrencyID
			where r.FinancialPeriodID = @FinancialPeriod and
			      (t.[Type] = 1 or t.[Type] = 2) and 
				  r.PartyID = @CustomerID) a


	insert into #inBaseCurrencies
		select isnull(sum(a.AmountInBaseCurrency),0) from (
			select case when c.IsBaseCurrencyBasis = 0 then
							round(s.Amount * s.CurrencyRate / c.ExchangeUnit,[CFG].[GetBaseCurrencyPrecision]())
						when c.IsBaseCurrencyBasis = 1 then
							round(s.Amount * c.ExchangeUnit / s.CurrencyRate,[CFG].[GetBaseCurrencyPrecision]())
					end as AmountInBaseCurrency 

			from FIN.PaymentSubject s
			join FIN.PaymentReceipt r on s.PaymentReceiptID = r.PaymentReceiptID
			join FIN.PaymentType t on s.PaymentTypeID = t.PaymentTypeID
			join CFG.Currency c on s.CurrencyID = c.CurrencyID
			where FinancialPeriodID = @FinancialPeriod
                  AND DLID = ( SELECT DlID
                               FROM   CFG.Party
                               WHERE  PartyID = @CustomerID
                             )
                  AND t.[Type] = 2) a


	insert into #inBaseCurrencies
		select isnull(a.TotalNetPrice,0) from (		
			SELECT sum(TotalNetPrice) TotalNetPrice
            FROM   POS.PosInvoice
            WHERE  FinancialPeriodID = @FinancialPeriod
                   AND Status <> 3
				   AND IsReturnInvoice = 0
                   AND ( @PosInvoiceId IS NULL
                                 OR PosInvoiceID <> @PosInvoiceId
                             )
                   AND CustomerID = @CustomerID) a
		

	insert into #inBaseCurrencies
		select isnull(a.TotalNetPrice,0) from (
			SELECT   sum(-TotalNetPrice) TotalNetPrice
			FROM     POS.PosInvoice
			WHERE    FinancialPeriodID = @FinancialPeriod
                     AND Status <> 3
		             AND IsReturnInvoice = 1
                     AND ( @PosInvoiceId IS NULL 
							OR PosInvoiceID <> @PosInvoiceId
						)
                     AND CustomerID = @CustomerID) a


	insert into #inBaseCurrencies
		select isnull(a.TotalAmount,0) from (
			SELECT   sum(-TotalAmount) TotalAmount
            FROM     POS.PosReceipt
            WHERE    FinancialPeriodID = @FinancialPeriod
					 AND IsPayed = 0
                     AND CustomerID = @CustomerID) a


	insert into #inBaseCurrencies
		select isnull(a.TotalAmount,0) from (
			SELECT  sum(TotalAmount) TotalAmount
            FROM    POS.PosReceipt
            WHERE   FinancialPeriodID = @FinancialPeriod
					AND IsPayed = 1
                    AND CustomerID = @CustomerID) a


	 select @Remain = sum(AmountInBaseCurrency) from #inBaseCurrencies 

	 IF OBJECT_ID('tempdb..#inBaseCurrencies') IS Not NULL
		DROP TABLE #inBaseCurrencies

