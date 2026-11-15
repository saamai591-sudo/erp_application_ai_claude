
CREATE   PROCEDURE [POS].GetPosInvoiceList
(
    @FinancialPeriodID INT, 
    @IsReturnInvoice BIT,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @Culture VARCHAR(10),
            @ViewRelatedToUser INT,
            @ViewRelatedToOthers NVARCHAR(MAX),
            @UnauthorizedUsers NVARCHAR(MAX);

    SET @Culture = CFG.GetuserCulture();
    SET @UserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    DECLARE @engName NVARCHAR(100);
    IF @IsReturnInvoice = 0
    BEGIN
        SET @engName = N'PosInvoice';
    END;
    ELSE
    BEGIN
        SET @engName = N'PosReturnInvoice';
    END;

	SELECT @ViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = @engName
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = @engName
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

    declare @AccessKey nvarchar(200)
    set @AccessKey = @engName + '_ViewRelatedToOthers'

    -- declare properties Here

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'Number ';

    DECLARE @Cash NVARCHAR(100),
            @Revoke NVARCHAR(100),
            @Suspension NVARCHAR(100),
            @Credit NVARCHAR(100),
            @Installment NVARCHAR(100),
            @CashCredit NVARCHAR(100),
            @CashInstallment NVARCHAR(100),
            @NoPayedCompletely NVARCHAR(100),
            @Settlement NVARCHAR(100);

    SELECT @Cash = ls.Value
    FROM CFG.LocalizeEnum AS l
        JOIN CFG.LocalizeEnumValue AS ls
            ON l.LocalizeEnumID = ls.LocalizeEnumID
    WHERE l.Enum = 'PosInvoicesStatus'
          AND l.Item = 'Cash'
          AND ls.Culture = @Culture;

    SELECT @Revoke = ls.Value
    FROM CFG.LocalizeEnum AS l
        JOIN CFG.LocalizeEnumValue AS ls
            ON l.LocalizeEnumID = ls.LocalizeEnumID
    WHERE l.Enum = 'PosInvoicesStatus'
          AND l.Item = 'Revoke'
          AND ls.Culture = @Culture;

    SELECT @Suspension = ls.Value
    FROM CFG.LocalizeEnum AS l
        JOIN CFG.LocalizeEnumValue AS ls
            ON l.LocalizeEnumID = ls.LocalizeEnumID
    WHERE l.Enum = 'PosInvoicesStatus'
          AND l.Item = 'Suspension'
          AND ls.Culture = @Culture;

    SELECT @Credit = ls.Value
    FROM CFG.LocalizeEnum AS l
        JOIN CFG.LocalizeEnumValue AS ls
            ON l.LocalizeEnumID = ls.LocalizeEnumID
    WHERE l.Enum = 'PosInvoicesStatus'
          AND l.Item = 'Credit'
          AND ls.Culture = @Culture;

    SELECT @Installment = ls.Value
    FROM CFG.LocalizeEnum AS l
        JOIN CFG.LocalizeEnumValue AS ls
            ON l.LocalizeEnumID = ls.LocalizeEnumID
    WHERE l.Enum = 'PosInvoicesStatus'
          AND l.Item = 'Installment'
          AND ls.Culture = @Culture;

    SELECT @CashCredit = ls.Value
    FROM CFG.LocalizeEnum AS l
        JOIN CFG.LocalizeEnumValue AS ls
            ON l.LocalizeEnumID = ls.LocalizeEnumID
    WHERE l.Enum = 'PosInvoicesStatus'
          AND l.Item = 'CashCredit'
          AND ls.Culture = @Culture;

    SELECT @CashInstallment = ls.Value
    FROM CFG.LocalizeEnum AS l
        JOIN CFG.LocalizeEnumValue AS ls
            ON l.LocalizeEnumID = ls.LocalizeEnumID
    WHERE l.Enum = 'PosInvoicesStatus'
          AND l.Item = 'CashInstallment'
          AND ls.Culture = @Culture;

    SELECT @Settlement = ls.Value
    FROM CFG.LocalizeEnum AS l
        JOIN CFG.LocalizeEnumValue AS ls
            ON l.LocalizeEnumID = ls.LocalizeEnumID
    WHERE l.Enum = 'DeliveryItemStatus'
          AND l.Item = 'Settlement'
          AND ls.Culture = @Culture;

    SELECT @NoPayedCompletely = ls.Value
    FROM CFG.LocalizeEnum AS l
        JOIN CFG.LocalizeEnumValue AS ls
            ON l.LocalizeEnumID = ls.LocalizeEnumID
    WHERE l.Enum = 'PosInvoicesStatus'
          AND l.Item = 'NoPayedCompletely'
          AND ls.Culture = @Culture;


	select *
	into #StationShiftAccess
	from [CFG].[vwStationShiftAccess]

    DECLARE @Query NVARCHAR(MAX);
    SET @Query
        = N'
 		WITH Query_Result 
		as
		(
			SELECT  PosInvoiceID , 
					FinancialPeriodID ,  
					Number ,  
					Date ,  
					Date_Original , 
					Date_Date , 
					StockID , 
					StockId_Original , 
					CustomerID , 
					TotalPrice , 
					TotalDiscount , 
					TotalNetPrice , 
					TotalTax , 
					TotalDuty , 
					HasInstallment , 
					HasCredit , 
					Version ,
					Creator , 
					CreationDate , 
					LastEditor , 
					LastEditionDate , 
					Status , 
					IsReturnInvoice ,  
					CreateDateString ,  
					EditionDateString ,
					CustomerCode , 
					IsNotInFlow , 
					CustomerName , 
					CustomerName2, 
					CreatorUserName , 
					EditorName , 
					StateShiftID , 
					StationID ,  
					StationTitle , 
					StationTitle2, 
					StationShiftTitle , 
					StationShiftTitle2,
					HasCheque ,
					HasCash ,
					HasCardReader ,                     
                    HasSubscribeCardCharge	,
	                HasShoppingCart			,
					CashAmount , 
					PosReceiptID , 
					StockCode , 
					StockTitle , 
					StockTitle2,
					CASE WHEN  TotalNetPrice - CashAmount < 0 THEN N''مازاد دریافتی''
                         WHEN Status = 3 THEN @Revoke
						 WHEN Status = 2 THEN @Suspension
						 WHEN HasCredit = 1 AND HasPay = 1 AND IsReturnInvoice = 0 THEN @CashCredit
						 
						 WHEN HasCredit = 1 AND HasPay = 1 AND IsReturnInvoice = 1 THEN 
							CASE WHEN CashAmount >= ReturnCashAmount THEN @Settlement ELSE  @NoPayedCompletely END
						 
						 WHEN HasInstallment = 1 AND HasPay = 1 AND IsReturnInvoice = 0 THEN @CashInstallment
						 
						 WHEN HasInstallment = 1 AND HasPay = 1 AND IsReturnInvoice = 1 THEN 
							CASE WHEN CashAmount >= ReturnCashAmount THEN @Settlement ELSE  @NoPayedCompletely END
						 
						 WHEN HasCredit = 1
							  AND HasPay = 0 THEN @Credit
						 WHEN HasInstallment = 1
							  AND HasPay = 0 THEN @Installment
						 WHEN CashAmount < TotalNetPrice THEN @NoPayedCompletely
						 ELSE @Cash
					END StatusString,
					BasePosInvoiceID,
					BasePosInvoiceNumber,
					SaleAgentID,
					SaleAgentTitle,
					SaleAgentTitle2,
                    PricingCalculationID,
                    TotalItems = (select Count(PosInvoiceItemID) from POS.PosInvoiceItem pii where pii.PosInvoiceID = aa.PosInvoiceID)
    FROM    ( SELECT    p.PosInvoiceID , p.FinancialPeriodID , p.Number , p.[Date] , p.[Date] Date_Original ,  CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) Date_Date ,
                        p.StockID , p.StockID StockId_Original , p.CustomerID ,  p.TotalPrice ,  p.TotalDiscount , p.TotalNetPrice ,  p.TotalTax ,
                        p.TotalDuty ,
						CASE WHEN p.BasePosInvoiceID IS NOT NULL THEN pin.HasInstallment
							ELSE p.HasInstallment
					    END HasInstallment,
                        CASE WHEN p.BasePosInvoiceID IS NOT NULL THEN pin.HasCredit
							ELSE p.HasCredit
					    END HasCredit ,
                        p.Version ,
                        p.Creator ,
                        p.CreationDate ,
                        p.LastEditor ,
                        p.LastEditionDate ,
                        p.Status ,
                        p.IsReturnInvoice ,
                        CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 1,
                                             @DateType) CreateDateString ,
                        CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 1,
                                             @DateType) EditionDateString ,
                        d.Code CustomerCode ,
                        CAST(CASE WHEN EXISTS ( SELECT  1
                                                FROM    POS.DeliveryPosInvoice
                                                WHERE   PosInvoiceID = p.PosInvoiceID )
                                  THEN 0
                                  ELSE 1
                             END AS BIT) IsNotInFlow ,
						ISNULL(pa.Title, '''') + '' '' + ISNULL(pa.LastName, '''')  AS CustomerName ,
						ISNULL(pa.Title2, '''') + '' '' + ISNULL(pa.LastName2, '''')  AS CustomerName2 ,
                        u.Name CreatorUserName ,
                        u2.Name EditorName ,
                        p.StateShiftID ,
                        s.StationID ,
                        s.Title StationTitle ,
						s.Title2 StationTitle2 ,
                        ss.Title StationShiftTitle ,
						ss.Title2 StationShiftTitle2 ,
                     
                        HasSubscribeCardCharge	=ISNULL(PosReceiptItem.HasSubscribeCardCharge	,0),
	                    HasShoppingCart			=ISNULL(PosReceiptItem.HasShoppingCart			,0),
	                    HasCardReader			=ISNULL(PosReceiptItem.HasCardReader			,0),
	                    HasCash					=ISNULL(PosReceiptItem.HasCash					,0),
	                    HasCheque				=ISNULL(PosReceiptItem.HasCheque				,0),

                        ISNULL(PosReceiptAmount.TotalAmount, 0) CashAmount ,
                        ppp.PosReceiptID ,
                        st.Code StockCode ,
                        st.Title StockTitle ,
						st.Title2 StockTitle2 ,
                        CASE WHEN ppp.PosReceiptID IS NOT NULL THEN 1
                             ELSE 0
                        END HasPay,
						p.BasePosInvoiceID,
						pin.Number AS BasePosInvoiceNumber,
						ISNULL(ReturnPosReceiptAmount.TotalAmount, 0) ReturnCashAmount,
						p.SaleAgentID,
						par.Title +'' ''+ ISNULL(par.LastName, '''') as SaleAgentTitle,
						par.Title2 +'' ''+ ISNULL(par.LastName2, '''') as SaleAgentTitle2,
						p.TotalNetPriceBeforeRound,
                        p.PricingCalculationID
              FROM      POS.PosInvoice p
						LEFT JOIN SLE.SaleAgent sa on sa.SaleAgentID = p.SaleAgentID
						LEFT JOIN CFG.Party par ON par.PartyID = sa.PartyID
						LEFT JOIN POS.PosInvoice AS pin ON p.BasePosInvoiceID = pin.PosInvoiceID
						LEFT JOIN ( SELECT  ISNULL(SUM(TotalAmount), 0)
                                            + ISNULL(SUM(Discount), 0) TotalAmount ,
                                            PosInvoiceID
                                    FROM    POS.PosReceipt
                                    GROUP BY PosInvoiceID
                                  ) ReturnPosReceiptAmount ON ReturnPosReceiptAmount.PosInvoiceID = pin.PosInvoiceID

                        JOIN CFG.Party pa ON pa.PartyID = p.CustomerID
                        JOIN ACC.DL d ON d.DLID = pa.DlID
                        JOIN CFG.[User] u ON u.UserID = p.Creator
                        JOIN CFG.[User] u2 ON u2.UserID = p.LastEditor
                        JOIN POS.StationShift ss ON ss.StationShiftID = p.StateShiftID
                        LEFT JOIN STF.Stock st ON st.StockID = p.StockID
                        JOIN POS.Station s ON s.StationID = ss.StationID
                        LEFT JOIN ( SELECT  PosReceiptID ,
                                            PosInvoiceID
                                    FROM    POS.PosReceipt
                                  ) ppp ON ppp.PosInvoiceID = p.PosInvoiceID
                        LEFT JOIN ( 
                                    SELECT 
	                                    pr.PosInvoiceID,
                                        PosReceiptID			= convert(bit, case when max(pr.PosReceiptID)        > 0 then 1 else 0 end),
	                                    HasSubscribeCardCharge	= convert(bit, case when max(SubscribeCardChargeID)  > 0 then 1 else 0 end),
	                                    HasShoppingCart			= convert(bit, case when max(ShoppingCartID)         > 0 then 1 else 0 end),
	                                    HasCardReader			= convert(bit, case when max(CardReaderID)           > 0 then 1 else 0 end),
	                                    HasCash					= convert(bit, case when max(CashID)                 > 0 and max(pri.ItemType) in (1, 2, 6)  then 1 else 0 end),
	                                    HasCheque				= convert(bit, case when max(CashID)                 > 0 and max(pri.ItemType) = 5           then 1 else 0 end)
                                    FROM POS.PosReceipt pr
                                    JOIN POS.PosReceiptItem pri ON pri.PosReceiptID = pr.PosReceiptID
                                    WHERE pr.IsPayed = 0
                                    group by pr.PosInvoiceID
                                  ) PosReceiptItem ON PosReceiptItem.PosInvoiceID = p.PosInvoiceID
                        LEFT JOIN ( SELECT  ISNULL(SUM(TotalAmount), 0)
                                            + ISNULL(SUM(Discount), 0) TotalAmount ,
                                            PosInvoiceID
                                    FROM    POS.PosReceipt
                                    GROUP BY PosInvoiceID
                                  ) PosReceiptAmount ON PosReceiptAmount.PosInvoiceID = p.PosInvoiceID
                        join #StationShiftAccess vwssa on vwssa.StationShiftID =  p.StateShiftID
            WHERE   p.IsReturnInvoice = @IsReturnInvoice
                AND p.FinancialPeriodID = @FinancialPeriodID
                AND ( @UserID = -1
                        OR ( @ViewRelatedToUser IS NOT NULL AND p.Creator = @UserID )
                        OR ( @ViewRelatedToOthers IS NOT NULL AND p.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst ) )
                    )
            ) aa
		)
	';

    --PRINT 111;

    PRINT @Query;
    DECLARE @selectQuery NVARCHAR(MAX);

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';


    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);


    SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);
    --PRINT @Query;

    EXECUTE sp_executesql @Query,
                          N'	@dateFormat varchar(10),
				@dateType int, 
				@FinancialPeriodID int,
				@ViewRelatedToOthers NVARCHAR(MAX),
				@UnauthorizedUsers   NVARCHAR(MAX),
				@ViewRelatedToUser int,
				@IsReturnInvoice bit,
				@UserID int,
				@Cash NVARCHAR(100) ,
				@Revoke NVARCHAR(100) ,
				@Suspension NVARCHAR(100) ,
				@Settlement NVARCHAR(100) ,
				@Credit NVARCHAR(100) ,
				@Installment NVARCHAR(100) ,
				@CashCredit NVARCHAR(100) ,
				@CashInstallment NVARCHAR(100),
				@NoPayedCompletely NVARCHAR(100),
                @AccessKey nvarchar(200)',
                @DateFormat = @DateFormat,
                @DateType = @DateType,
                @FinancialPeriodID = @FinancialPeriodID,
                @ViewRelatedToOthers = @ViewRelatedToOthers,
                @UnauthorizedUsers = @UnauthorizedUsers,
                @ViewRelatedToUser = @ViewRelatedToUser,
                @IsReturnInvoice = @IsReturnInvoice,
                @UserID = @UserID,
                @Cash = @Cash,
                @Revoke = @Revoke,
                @Suspension = @Suspension,
                @Credit = @Credit,
                @Installment = @Installment,
                @Settlement = @Settlement,
                @CashCredit = @CashCredit,
                @CashInstallment = @CashInstallment,
                @NoPayedCompletely = @NoPayedCompletely,
                @AccessKey = @AccessKey;


    DECLARE @Count INT;

    EXEC ('SELECT * FROM ' + @tableName + ' ORDER BY _RN');

    SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);
END;

