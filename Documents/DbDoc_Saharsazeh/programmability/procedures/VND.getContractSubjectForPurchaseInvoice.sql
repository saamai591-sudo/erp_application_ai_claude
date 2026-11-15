
CREATE   PROC [VND].getContractSubjectForPurchaseInvoice
	(
		@ids VARCHAR(500) ,
		@date DATE ,
		@Branch INT ,
		@dl BIGINT
	)

--WITH ENCRYPTION
AS
	declare @Culture NVARCHAR(100),
			@CultureNo tinyint
		
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

		select * into #vwContractSubject_Stuff_Non
		from CNT.vwContractSubject_Stuff_Non
		where PartyDlID = @dl


	select * into #vwStuff
	from stf.VWStuff


	SELECT c.ContractID ,
		   cs.ContractSubjectID ,
		   c.Number ,
		   cs.StuffID,
		   s.Code StuffCode,
		   case @CultureNo
				when 1 then s.Title
				when 2 then s.Title2
			end as StuffTitle, 
		   case @CultureNo
				when 1 then cs.Title
				when 2 then cs.Title2
			end as Title, 
			cs.Quantity,
			case 
				when non.QuantityIncreasable = 1 then 0 
				else non.Non 
			end Non ,
			CAST(non.FeeChangeble AS BIT) FeeChangable,
			CAST(non.QuantityIncreasable AS BIT) QuantityIncreasable,
		   cs.Fee ,
		   d.Code DlCode ,
		   CFG.GetCLRSaturnDate(c.Date, 'YY/MM/DD', 0, 0) DateString
	FROM   CNT.Contract c
		   JOIN CNT.vwContractSubject cs ON c.ContractID = cs.ContractID
		   JOIN CFG.Party p ON p.PartyID = c.PartyID
		   JOIN #vwStuff AS s ON s.StuffID = cs.StuffID
		   left join CNT.Contract c2 on c.ParentID = c2.ContractID
		   JOIN ACC.DL d ON d.DLID = case when c.ParentID is null then c.DLID else c2.DLID end
		   join #vwContractSubject_Stuff_Non non on cs.ContractSubjectID = non.ContractSubjectID
	WHERE  (non.Non>0 or non.QuantityIncreasable = 1)
		   AND c.BranchID = @Branch
		   AND c.Status = 2
		   AND cs.StuffID IS NOT NULL
		   AND ((c.ContractNature in (1,2) and p.DlID = @dl) or (c.ContractNature = 3 and @dl in (select dlid from cnt.ContractParty a join cfg.Party b on a.PartyID = b.PartyID where c.ContractID = c.ContractID)) or (c.ContractNature = 4))
		   AND c.Date <= @date

		   AND c.CompanyRoll = 1;
