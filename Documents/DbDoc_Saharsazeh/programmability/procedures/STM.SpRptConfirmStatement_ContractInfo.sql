
-------------------------------------
CREATE   PROC [STM].SpRptConfirmStatement_ContractInfo
	@ID nvarchar(max)
--WITH ENCRYPTION 
AS
	select [CFG].[GetStringPartBySpliter](value,1,'|') ContractID,
		[CFG].[GetStringPartBySpliter](value,2,'|') CurrencyID
		into #Contract
	from [CFG].[Split] (@ID,',')

	declare @UserID INT,
	        @DateType VARCHAR(10),
	        @DateFormat VARCHAR(10),
	        @Culture VARCHAR(10),
			@CultureNo int,
			@Columns NVARCHAR(MAX) ,
            @ColumnsInSelectList NVARCHAR(MAX) , 
			@ColumnsInPayedSelectList NVARCHAR(MAX) ,
			@Sum NVARCHAR(MAX) ,
			@query NVARCHAR(MAX)

	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo
	where Culture = @Culture
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD' 
	
	select 
		ContractID,
		CurrencyID,
		SUM(case when ReceiptAndPaymentType = 'DownPayment' then Amount else 0 end) DownPayment,
		SUM(case when ReceiptAndPaymentType = 'OnAccount' and Amount > 0 then Amount else 0 end)   OnAccount,
		SUM(case when ReceiptAndPaymentType = 'OnAccount' and Amount < 0 then Amount else 0 end)   DepOnAccount,
		SUM(case when BaseDocumentType = 'confirmstatement' then Amount else 0 end) PayedConfirmStatement,
		SUM(case when BaseDocumentType = 'PurchaseInvoice' or BaseDocumentType = 'ConfirmPurchaseInvoice' then Amount else 0 end)  PayedPurchaseInvoice
	into #ReceiptAndPayment
	from [CNT].VWReceiptAndPayment
	group by ContractID,
			 CurrencyID	

	select 
		ContractID,
		OriginVatCurrency ,
		SUM(Amount)  PayedonVat
	into #ReceiptAndPayment_Vat
	from [CNT].VWReceiptAndPayment
	where BaseDocumentType = 'Vat'
	group by ContractID,
	OriginVatCurrency

	select *
	into #PurchaseInvoiceItem_ContractSubject
	from
	(
	select a.PurchaseInvoiceID,ContractID
	from vnd.PurchaseInvoiceItem a
	join cnt.ContractSubject b on a.ContractSubjectID = b.ContractSubjectID
	union all
	select a.PurchaseInvoiceID,ContractID
	from vnd.PurchaseInvoiceItem a
	join stc.StockReceiptItem sri on sri.StockReceiptItemID = a.StockReceiptItemID
	join cnt.ContractSubject b on sri.ContractSubjectID = b.ContractSubjectID
	)a
	group by a.PurchaseInvoiceID,ContractID

	select AdditionDeductionTypeID,ContractID,CurrencyID,SUM(Value) Value
	into #AdditionDeduction
	from
	(
		select AdditionDeductionTypeID,cs.ContractID,CurrencyID,csi.Deduction - csi.Addition Value
		from CNT.ConfirmStatementItem csi
		join cnt.ConfirmStatement cs
			on cs.ConfirmStatementID = csi.ConfirmStatementID
		join cnt.ContractStatement cs1
			on cs1.ContractStatementID = cs.ContractStatementID

		union all
	
		select AdditionDeductionTypeID,ContractID,pi.CurrencyID,csi.Deduction - csi.Addition Value
		from CNT.ConfirmStatementItem csi
		join vnd.PurchaseInvoice pi
			on pi.PurchaseInvoiceID = csi.PurchaseInvoiceID
		JOIN #PurchaseInvoiceItem_ContractSubject pii on pii.PurchaseInvoiceID = pi.PurchaseInvoiceID

		union all

		select AdditionDeductionTypeID,ContractID,p.CurrencyID,i.Deduction - i.Addition  Value
		from vnd.ConfirmPurchaseInvoiceItem i
		join vnd.ConfirmPurchaseInvoice h on h.ConfirmPurchaseInvoiceID = i.ConfirmPurchaseInvoiceID
		join vnd.PurchaseInvoice p on p.PurchaseInvoiceID = h.PurchaseInvoiceID
		JOIN #PurchaseInvoiceItem_ContractSubject pii on pii.PurchaseInvoiceID = p.PurchaseInvoiceID

	)a
	group by AdditionDeductionTypeID,ContractID,CurrencyID	

	select 
		ContractID,
		CurrencyID,
		BaseDocID,
		SUM(Amount) Amount
	into #ConfirmStatementItem
	from [CNT].VWReceiptAndPayment
	where BaseDocumentType = 'additiondeduction'
	group by ContractID,
			 CurrencyID	,
			 BaseDocID

	SELECT  AdditionDeductionTypeID,
			A.ContractID,
			A.CurrencyID,
			A.Amount
	INTO #AdditionDeductionPayed
	FROM #ConfirmStatementItem A
	JOIN CNT.ConfirmStatementItem B
		ON A.BaseDocID = B.ConfirmStatementItemID

    SELECT @Columns = STUFF(
    (   SELECT DISTINCT ',' + QUOTENAME(AdditionDeductionTypeID)
        FROM   CNT.AdditionDeductionType
        FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,1   ,1   ,''  );

    IF ( @Columns IS NULL )
        SET @Columns = '[-1]';

    SELECT @ColumnsInSelectList = STUFF(
    (   SELECT DISTINCT ',ISNULL(p1.' + QUOTENAME(AdditionDeductionTypeID)
                        + ',0) AS T'
                        + CAST(AdditionDeductionTypeID AS VARCHAR(10))
        FROM   CNT.AdditionDeductionType
        FOR XML PATH(''), TYPE        ).value('.', 'NVARCHAR(MAX)') ,1   ,1   ,''  );

    IF ( @ColumnsInSelectList IS NULL )
        SET @ColumnsInSelectList = '';

    SELECT @ColumnsInPayedSelectList = STUFF(
    (   SELECT DISTINCT ',ISNULL(p2.' + QUOTENAME(AdditionDeductionTypeID)
                        + ',0) AS PayedT'
                        + CAST(AdditionDeductionTypeID AS VARCHAR(10))
        FROM   CNT.AdditionDeductionType
        FOR XML PATH(''), TYPE             ).value('.', 'NVARCHAR(MAX)') ,1   ,0   ,''  );

    IF ( @ColumnsInPayedSelectList IS NULL )
        SET @ColumnsInPayedSelectList = '';

    SELECT @Sum = STUFF(
    (   SELECT DISTINCT '+ISNULL(p1.' + QUOTENAME(AdditionDeductionTypeID)
                        + ',0)'
        FROM   CNT.AdditionDeductionType
        FOR XML PATH(''), TYPE        ).value('.', 'NVARCHAR(MAX)') ,1   ,1   ,''  );

    IF ( @Sum IS NULL )
        SET @Sum = '0'

	select  ContractID,
			CurrencyID,
			SUM(FunctionalStatement) FunctionalStatement,
			SUM(AdjustmentStatement) AdjustmentStatement,
			SUM(SuspensionStatement) SuspensionStatement,
			SUM(Vat) Vat
	into #CSR1
	from
	(
	select  a.ContractID,
			b.CurrencyID,
			case when c.[Type] in (1,4) then Amount else 0 end FunctionalStatement,
			case when c.[Type] = 2 then Amount else 0 end AdjustmentStatement,
			case when c.[Type] = 3 then Amount else 0 end SuspensionStatement,
			Vat
	from cnt.ConfirmStatement a
	join cnt.ContractStatement b on a.ContractStatementID = b.ContractStatementID
	join cnt.ContractStatementType c on c.ContractStatementTypeID = b.ContractStatementTypeID
	join cfg.Currency  on b.CurrencyID = Currency.CurrencyID
	join 
		(
			select ContractStatementID,SUM(Tax + Duty) Vat
			from CNT.ContractStatementitem
			group by ContractStatementID
		)d on d.ContractStatementID = b.ContractStatementID
	)a
	group by a.ContractID,a.CurrencyID

	select  ContractID,
			CurrencyID,
			Sum(PurchaseInvoiceAmount) PurchaseInvoiceAmount,
			sum(vat) vat
	into #PurchaseInvoice
	from
	(
		select  ContractID,
				b.CurrencyID,
				a.Price-a.Discount PurchaseInvoiceAmount,
				CASE 
					WHEN Currency.IsBaseCurrencyBasis = 0 THEN ROUND(
							(a.tax+a.duty) * h.CurrencyRate / Currency.ExchangeUnit,
							[CFG].[GetBaseCurrencyPrecision]()
						)
					WHEN Currency.IsBaseCurrencyBasis = 1 THEN ROUND(
							(a.tax+a.duty) * Currency.ExchangeUnit / h.CurrencyRate,
							[CFG].[GetBaseCurrencyPrecision]()
						)
				END 	Vat
		from vnd.PurchaseInvoiceItem a
		join vnd.PurchaseInvoice h
			on a.PurchaseInvoiceID = h.PurchaseInvoiceID
		join cnt.vwContractSubject b
			on a.ContractSubjectID = b.ContractSubjectID
		join cfg.Currency  
			on h.CurrencyID = Currency.CurrencyID

		union all

		select  ContractID,
				b.CurrencyID,
				a.Price-a.Discount PurchaseInvoiceAmount,
				CASE 
					WHEN Currency.IsBaseCurrencyBasis = 0 THEN ROUND(
							(a.tax+a.duty) * h.CurrencyRate / Currency.ExchangeUnit,
							[CFG].[GetBaseCurrencyPrecision]()
						)
					WHEN Currency.IsBaseCurrencyBasis = 1 THEN ROUND(
							(a.tax+a.duty) * Currency.ExchangeUnit / h.CurrencyRate,
							[CFG].[GetBaseCurrencyPrecision]()
						)
				END 	Vat
		from vnd.PurchaseInvoiceItem a
		join stc.StockReceiptItem sri on sri.StockReceiptItemID = a.StockReceiptItemID
		join vnd.PurchaseInvoice h
			on a.PurchaseInvoiceID = h.PurchaseInvoiceID
		join cnt.vwContractSubject b
			on sri.ContractSubjectID = b.ContractSubjectID
		join cfg.Currency  
			on h.CurrencyID = Currency.CurrencyID
	)a
	group by ContractID,CurrencyID

    SET @query = N'SELECT  a.ContractID,
			vw.Price ContractTotal,
			case when Amendment.Life is not null then Amendment.Life else a.Life end Life,
			cfg.GetCLRSaturnDate(a.StartDate,@DateFormat,0,@DateType) ContractStartDate,
			cfg.GetCLRSaturnDate(
						case when Amendment.EndDate is not null	
								then Amendment.EndDate else a.EndDate end,@DateFormat,0,@DateType) ContractEndDate,
			cfg.GetCLRSaturnDate(a.Date,@DateFormat,0,@DateType) ContractDate,
			dl.Code ContractCode,
			case when @CultureNo = 1 then
			CASE  pa.PartyID WHEN 0 THEN pa.Title +  + pa.LastName
							 ELSE pa.Title
				END
				when @CultureNo = 2 then 
					CASE  pa.PartyID WHEN 0 THEN pa.Title2 +  + pa.LastName2
							 ELSE pa.Title2
				END
				end PartyName,
			a.Type ContractType,
			a.Number ContractNumber,
			case when @CultureNo = 1 then a.Title else a.Title2 end TitleContract,
			  isnull(csr1.FunctionalStatement,0) 
			+ isnull(PurchaseInvoice.PurchaseInvoiceAmount,0) 
			  as [Statement],
			  isnull(csr1.FunctionalStatement,0) 
			+ isnull(csr1.AdjustmentStatement,0) 
			+ isnull(csr1.SuspensionStatement,0) 
			+ isnull(PurchaseInvoice.PurchaseInvoiceAmount,0) 
			- ('+@Sum+')
			  as Payable,
			isnull(PayedConfirmStatement,0) + isnull(PayedPurchaseInvoice,0)  Payed,
			RAP.DownPayment Prepayment,
			RAP.OnAccount OnAccount,
			ABS(RAP.DepOnAccount) DepOnAccount,
			case when @CultureNo = 1 then Currency.Title else Currency.Title2 end Currency,
			isnull(csr1.Vat,0) + isnull(PurchaseInvoice.Vat,0) Vat,
			PayedonVat,
			isnull(DepPrepayment,0) DepPrepaymentInPurchase,
		   ' + @ColumnsInSelectList + @ColumnsInPayedSelectList+'
	FROM CNT.Contract a 
	join
	(
		select ContractID,CurrencyID,SUM(Price) Price
		from CNT.VWContractSubject
		group by ContractID,CurrencyID
	)vw
		on vw.ContractID = a.ContractID
	join #Contract b on a.ContractID = b.ContractID and vw.CurrencyID = b.CurrencyID
	join CFG.Currency
	 on Currency.CurrencyID = vw.CurrencyID
	JOIN ACC.DL dl 
		ON dl.DLID=a.DLID
	JOIN CFG.Party pa 
		ON pa.PartyID=a.PartyID
	left join #ReceiptAndPayment RAP on RAP.ContractID = a.ContractID and RAP.CurrencyID = vw.CurrencyID
	left join #ReceiptAndPayment_Vat vat on vat.ContractID = a.ContractID
    LEFT JOIN
    (
        SELECT ROW_NUMBER() OVER (PARTITION BY ParentID ORDER BY Date DESC) Rno,
                ParentID,
                Life,
                EndDate
        FROM CNT.Contract
        WHERE ParentID IS NOT NULL
    ) Amendment
        ON Amendment.Rno = 1
            AND Amendment.ParentID = a.ContractID
	left join #CSR1 csr1 on  csr1.ContractID = a.ContractID 
			  and csr1.CurrencyID = vw.CurrencyID
	left join #PurchaseInvoice PurchaseInvoice
			on PurchaseInvoice.ContractID = a.ContractID and PurchaseInvoice.CurrencyID = vw.CurrencyID
	left join
	(
		select ContractID,CurrencyID,sum(a.Price) DepPrepayment
		from vnd.PurchaseInvoicePrePayment a
		join 
		(
			select b.PurchaseInvoiceID,c.ContractID,c.CurrencyID
			from vnd.PurchaseInvoiceItem b
			join cnt.VWContractSubject c
				on b.ContractSubjectID = c.ContractSubjectID
			group by b.PurchaseInvoiceID,c.ContractID,c.CurrencyID
		)b
			on a.PurchaseInvoiceID = b.PurchaseInvoiceID
		group by ContractID,CurrencyID
	) DP on DP.ContractID = a.ContractID and dp. CurrencyID = vw.CurrencyID
	left join
		(
			select *
			from #AdditionDeduction
		)x
		pivot
		(
			max(value)
			for AdditionDeductionTypeID in (' + @Columns + ')			
		)P1 on p1.ContractID = a.ContractID 
			and p1.CurrencyID = vw.CurrencyID
	left join
		(
			select AdditionDeductionTypeID,ContractID,CurrencyID,SUM(Amount) Value
			from #AdditionDeductionPayed
			group by AdditionDeductionTypeID,ContractID	,CurrencyID		
		)x
		pivot
		(
			max(value)
			for AdditionDeductionTypeID in (' + @Columns + ')			
		)P2 on p2.ContractID = a.ContractID 
			and p2.CurrencyID = vw.CurrencyID
	'
	
	EXECUTE sp_executesql @query ,
                        N'@DateFormat varchar(max),  
						@DateType int,
						@CultureNo char(1)' ,
                        @DateFormat = @DateFormat ,
                        @DateType = @DateType ,
						@CultureNo = @CultureNo;
