
-----------------------------------------
CREATE   PROC [CNT].RptContract
(
	@Contracts VARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
    DECLARE @UserID INT ,
            @DateType TINYINT ,
            @Culture VARCHAR(10) ,
            @DateFormat VARCHAR(10) ,
            @Columns NVARCHAR(MAX) ,
            @ColumnsInPayedSelectList NVARCHAR(MAX) ,
            @ColumnsInSelectList NVARCHAR(MAX) ,
            @query NVARCHAR(MAX) ,
            @param NVARCHAR(MAX) ,
            @CodeAndTitleColumn NVARCHAR(MAX) ,
            @LeftJoin NVARCHAR(MAX) ,
            @CultureNo char(1);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM   CFG.CultureInfo
    WHERE  Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Type'
           AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                             WHEN 'fa' THEN 0
                             WHEN 'en' THEN 1
                             WHEN 'ar' THEN 2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM   CFG.UserSetting us
    WHERE  us.SettingKey = 'Date_Format'
           AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

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
        FOR XML PATH(''), TYPE        ).value('.', 'NVARCHAR(MAX)') ,1   ,0   ,''  );

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

	select a.PurchaseInvoiceID,ContractID
	into #PurchaseInvoiceItem_ContractSubject
	from vnd.PurchaseInvoiceItem a
	join cnt.ContractSubject b on a.ContractSubjectID = b.ContractSubjectID
	group by a.PurchaseInvoiceID,ContractID

	select AdditionDeductionTypeID,ContractID,CurrencyID,SUM(Value) Value
	into #AdditionDeduction
	from
	(
		select AdditionDeductionTypeID,cs.ContractID,CurrencyID,csi.Deduction - csi.Addition - csi.Paid Value
		from CNT.ConfirmStatementItem csi
		join cnt.ConfirmStatement cs
			on cs.ConfirmStatementID = csi.ConfirmStatementID
		join cnt.ContractStatement cs1
			on cs1.ContractStatementID = cs.ContractStatementID

		union all
	
		select AdditionDeductionTypeID,ContractID,pi.CurrencyID,csi.Deduction - csi.Addition - csi.Paid Value
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

	SELECT * 
	INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess 

	select ContractID,
		CurrencyID,
		SUM(case when ReceiptAndPaymentType = 'DownPayment' then Amount else 0 end) DownPayment,
		SUM(case when ReceiptAndPaymentType = 'OnAccount' then Amount else 0 end)   OnAccount,
		SUM(case when BaseDocumentType = 'confirmstatement' then Amount else 0 end) PayedConfirmStatement,
		SUM(case when BaseDocumentType = 'PurchaseInvoice' or BaseDocumentType = 'ConfirmPurchaseInvoice' then Amount else 0 end)  PayedPurchaseInvoice
	into #ReceiptAndPayment
	from [CNT].VWReceiptAndPayment
	group by ContractID,
			 CurrencyID	

	SELECT  ContractID,
		OriginVatCurrency ,
		SUM(Amount)  PayedVat
	INTO #ReceiptAndPayment_Vat
	FROM [CNT].VWReceiptAndPayment
	WHERE BaseDocumentType = 'Vat'
	GROUP BY ContractID, OriginVatCurrency

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
	( select  ContractID,
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
	)a
	group by ContractID,CurrencyID

    SET @query = N'  
	SELECT c.ContractID ,
		   case when  @CultureNo = 1 then ct.Title else ct.Title2 end as ContractType,
           d.Code ContractDlCode ,
           c.Number ,
		   case when  @CultureNo = 1 then c.Title else c.Title2 end as Title,         
           d2.Code PartyDlCode ,            
		   case when  @CultureNo = 1 then d2.Title else d2.Title2 end as PartyName,
		   case when  @CultureNo = 1 then c2.Title else c2.Title2 end as Currency,
		   c2.CurrencyID,
           vw.Price Total ,
		   csr1.FunctionalStatement,
		   csr1.AdjustmentStatement,
		   csr1.SuspensionStatement,
		   RAP.PayedConfirmStatement,
		   isnull(PurchaseInvoice.PurchaseInvoiceAmount,0) PurchaseInvoiceAmount,	
		   isnull(PurchaseInvoice.vat,0) PurchaseVat,
		   isnull(RAP.PayedPurchaseInvoice,0) PayedPurchaseInvoice,
		   csr1.Vat,
		   vat.PayedVat,
		   case when vw.Price = 0 then 0 else (isnull(csr1.FunctionalStatement,0) + isnull(PurchaseInvoice.PurchaseInvoiceAmount,0)) / vw.Price * 100 end [Progress],
		   RAP.DownPayment,
		   RAP.OnAccount,
		   isnull(Commitment.Amount,0) Commitment
		   ' + @ColumnsInSelectList + @ColumnsInPayedSelectList+ '
    FROM    CNT.Contract c
	INNER JOIN  #vwBranchAccess Branch on Branch.BranchID = c.BranchID
    JOIN CNT.ContractType ct ON c.ContractTypeID = ct.ContractTypeID
    JOIN ACC.DL d ON d.DLID = c.DLID
    JOIN CFG.Party p ON p.PartyID = c.PartyID
    LEFT JOIN ACC.DL d2 ON d2.DLID = p.DLID
	join ( select ContractID,CurrencyID,sum(price) Price
		   from	cnt.vwcontractsubject
		   group by ContractID,CurrencyID
		 ) vw on c.ContractID = vw.ContractID
    JOIN CFG.Currency c2 ON vw.CurrencyID = c2.CurrencyID
    left JOIN #ReceiptAndPayment RAP on RAP.ContractID = c.ContractID and RAP.CurrencyID = c2.CurrencyID
    left JOIN #ReceiptAndPayment_Vat vat on vat.ContractID = c.ContractID and vat.OriginVatCurrency = c2.CurrencyID
	left join #CSR1 csr1 on  csr1.ContractID = c.ContractID and csr1.CurrencyID = c2.CurrencyID
	left join #PurchaseInvoice PurchaseInvoice
			on PurchaseInvoice.ContractID = c.ContractID and PurchaseInvoice.CurrencyID = c2.CurrencyID
	left join
		(
			select *
			from #AdditionDeduction
		)x
		pivot
		(
			max(value)
			for AdditionDeductionTypeID in (' + @Columns + ')			
		)P1 on p1.ContractID = c.ContractID 
			and p1.CurrencyID = c2.CurrencyID
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
		)P2 on p2.ContractID = c.ContractID 
			and p2.CurrencyID = c2.CurrencyID
	left join 
		(
			select ContractID,CurrencyID,SUM(Amount) Amount
			from CNT.VWContractCommitment
			group by ContractID	,CurrencyID
		) Commitment
		on Commitment.ContractID = c.ContractID  
		and Commitment.CurrencyID = c2.CurrencyID
	WHERE   
		(   @pContracts IS NULL
			OR c.ContractID IN (   SELECT value
									FROM   CFG.R_FnCommaStr2Table(@pContracts) ))
	and c.type = 1
	AND c.CompanyRoll = 1
	order by d.Code';
    SET @param = N'@pContracts varchar(max), @pDateFormat varchar(max),  @pDateType int,@CultureNo char(1)';
	print @query
    EXECUTE sp_executesql @query ,
                          @param ,
                          @pContracts = @Contracts ,
                          @pDateFormat = @DateFormat ,
                          @pDateType = @DateType ,
						  @CultureNo = @CultureNo;
