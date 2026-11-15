
CREATE   PROCEDURE [FOS].[GetProformaInvoiceItemBaseDocuments]
(
	@Type tinyint,
	@BranchID int = null,
	@PartyID bigint = null,
	@DLID bigint = null,
	@CurrencyID int = null,
	@Date date = null,
	@PurchaseContractID int = null
)
--WITH ENCRYPTION 
AS
BEGIN

    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
			@Culture NVARCHAR(100),
			@CultureNo tinyint
	   
	SET @UserID = CFG.GetuserID() 
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture		    
	
    SELECT  @DateType = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Type'
            AND us.UserID = @UserID
	
    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                        END
	
    SELECT  @DateFormat = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Format'
            AND us.UserID = @UserID
	
    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD'


	select p.PartyID,
	       d.Code PartyCode,
			CAST(CASE WHEN p.[Type] = 1
							OR p.[Type] = 2 THEN p.Title
						WHEN p.[Type] = 0 THEN p.Title + ' ' + p.LastName
				END AS NVARCHAR(512)) AS PartyName,
			CAST(CASE WHEN p.[Type] = 1
                            OR p.[Type] = 2 THEN p.Title2
                        WHEN p.[Type] = 0 THEN p.Title2 + ' ' + p.LastName2
                END AS NVARCHAR(512)) AS PartyName2
	into #Parties
	from CFG.Party p
	left join ACC.DL d on p.DlID = d.DLID


	if (@Type = 1)
	begin


		select i.PurchaseRequestItemID,
		       r.PurchaseRequestNumber Number,
		       CFG.GetCLRSaturnDate(r.PurchaseRequestDate, @DateFormat, 0, @DateType) PersianDate,
		       i.StuffID,
		       STF.GetStuffCode(s.StuffID) StuffCode,	
			   case @CultureNo
					when 1 then s.Title
					when 2 then s.Title2
			   end as StuffTitle, 				  
		       pri.Non MainQuantityRemain,
		       pri.NonSub SubQuantityRemain
		from REQ.PurchaseRequestItem i
		join REQ.PurchaseRequest r on i.PurchaseRequestID = r.PurchaseRequestID
		join STF.[Stuff] s on i.StuffID = s.StuffID
		join REQ.[PurchaseRequest_Remains] pri on i.PurchaseRequestItemID = pri.PurchaseRequestItemID 
		where r.BranchID = @BranchID and
			  r.PurchaseRequestDate <= @Date and
			  pri.Non > 0   

	end

	if (@Type = 2)
	begin

		DECLARE @value VARCHAR(50) = NULL;
        SELECT @value = f.ConfigValue
        FROM CFG.Configuration f
        WHERE f.ConfigKey = 'ProposalsNeededCommisionOpinion';
        IF (@value IS NOT NULL)
        BEGIN
			SET @value = LOWER(@value);
        END;

        SELECT i.ProposalItemID,
               p.Number,
			   CFG.GetCLRSaturnDate(p.Date, @DateFormat, 0, @DateType) PersianDate,
               p.PartyID,
               pa.PartyCode,              
				case @CultureNo
					when 1 then pa.PartyName
					when 2 then pa.PartyName2
			    end as PartyName, 
               i.StuffID,
               STF.GetStuffCode(s.StuffID) StuffCode,
               case @CultureNo
					when 1 then s.Title
					when 2 then s.Title2
			   end as StuffTitle,               
               i.Fee,
               i.Price,
               pr.MainRemain MainQuantityRemain,
               pr.SubRemain SubQuantityRemain
        FROM   VND.ProposalItem i
               JOIN VND.Proposal p ON i.ProposalID = p.ProposalID
               JOIN STF.[Stuff] s ON i.StuffID = s.StuffID
               JOIN #Parties pa ON p.PartyID = pa.PartyID
               JOIN VND.ProposalItem_NotImplementedRemain pr ON i.ProposalItemID = pr.ProposalItemID
        WHERE p.BranchID = @BranchID and
		      p.PartyID = @PartyID and 
			  p.CurrencyID = @CurrencyID and 
			  p.Date <= @Date and
              (@value IS NULL OR @value = 'false'
                       OR (@value = 'true'
                              AND i.ProposalItemID IN (SELECT ProposalItemID
                                                       FROM VND.ProposalCommissionItem)))
               AND pr.MainRemain > 0;

	end

	if (@Type = 4)
	begin

		if(@DLID is null)
		select @DlID = DlID from CFG.Party where PartyID = @PartyID

		select 
			   i.RowIndex,
			   i.PurchaseContractItemID,
		       c.Number,
		       CFG.GetCLRSaturnDate(c.Date, @DateFormat, 0, @DateType) PersianDate,
		       i.StuffID,
		       STF.GetStuffCode(s.StuffID) StuffCode,
		       case @CultureNo
					when 1 then s.Title
					when 2 then s.Title2
			   end as StuffTitle,
			   i.Fee,
			   i.Price,
		       r.Non MainQuantityRemain,
		       r.NonSub SubQuantityRemain,
			   i.Description,
			   i.Description2
		from VND.PurchaseContractItem i
		join VND.PurchaseContract c on i.PurchaseContractID = c.PurchaseContractID
		join STF.[Stuff] s on i.StuffID = s.StuffID
		join VND.PurchaseContract_Remains r on i.PurchaseContractItemID = r.PurchaseContractItemID 
		where c.BranchID = @BranchID and
	          @DlID is not null and
	          c.DlID = @DlID and
		      c.CurrencyID = @CurrencyID and
		      c.Date <= @Date and
			  (@PurchaseContractID IS NULL OR c.PurchaseContractID = @PurchaseContractID)  AND
		      r.Non > 0

	end

END

