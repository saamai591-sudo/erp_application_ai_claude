
---------------------------------------------------------
CREATE    PROCEDURE [VND].[GetNonProposalItemsForTempReceipt]
    (
        @stockId INT ,
        @date DATE ,
        @fiancialPeriod INT ,
        @ids NVARCHAR(MAX) ,
        @dlId BIGINT = NULL
    )
--WITH ENCRYPTION
AS
    BEGIN

        DECLARE @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10),
				@Culture NVARCHAR(5),
			    @CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

        IF ( @ids = '' )
            SET @ids = NULL;

        SET @UserID = CFG.GetuserID();

        SELECT @DateType = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Type'
               AND us.UserID = @UserID;

        IF @DateType IS NULL
            SET @DateType = CASE CFG.GetuserCulture()
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

        SELECT pri.ProposalItemID ,
               p.ProposalID ,
			   pri.RowIndex,
               p.Number ,
               pri.StuffID ,
               s.Code StuffCode ,
			   case @CultureNo
					when 1 then s.Title
					when 2 then s.Title2
		       end as  StuffTitle ,
               s.StuffDetailType,
               CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString ,
               pri.MainQuantity ,
               pri.SubQuantity ,
               pr.Non ,
               pr.NonSub
        FROM   VND.ProposalItem pri
               JOIN VND.Proposal p ON p.ProposalID = pri.ProposalID
               JOIN STF.[VWStuff] s ON s.StuffID = pri.StuffID
               JOIN VND.Proposal_Remains pr ON pr.ProposalItemID = pri.ProposalItemID
               JOIN CFG.Party pa ON pa.PartyID = p.PartyID
        WHERE  pr.Non > 0
               AND p.STatus = 2
               AND p.BranchID = (   SELECT BranchID
                                    FROM   STF.Stock
                                    WHERE  StockID = @stockId )
               AND p.Date <= @date
               -- AND p.FinancialPeriodID = @fiancialPeriod
               --AND ( @ids IS NULL
               --				  OR pri.ProposalItemID NOT IN (
               --				  SELECT    value
               --				  FROM      CFG.R_FnCommaStr2Table(@ids) )
               --				)
               AND (   @dlId IS NULL
                       OR pa.DlID = @dlId );

    END;
