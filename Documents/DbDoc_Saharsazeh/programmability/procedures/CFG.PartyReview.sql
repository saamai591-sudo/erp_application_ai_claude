CREATE PROCEDURE [CFG].PartyReview
AS
	DECLARE @NaturalPerson                  NVARCHAR(100),
	        @NonGovernmentalLegalPerson     NVARCHAR(100),
	        @GovernmentalLegalPerson        NVARCHAR(100),
			@CivilPartnership				NVARCHAR(100),
			@Culture varchar(25),
			@CultureNo TINYINT,
			@UserID INT
			

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
	SELECT @NaturalPerson = LV.Value
	FROM   CFG.LocalizeEnum L
	       JOIN CFG.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PartyType'
	       AND L.Item = 'NaturalPerson'
	       AND LV.Culture = @Culture
	
	SELECT @NonGovernmentalLegalPerson = LV.Value
	FROM   CFG.LocalizeEnum L
	       JOIN CFG.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PartyType'
	       AND L.Item = 'NonGovernmentalLegalPerson'
	       AND LV.Culture = @Culture

	SELECT @CivilPartnership = LV.Value
	FROM   CFG.LocalizeEnum L
	       JOIN CFG.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PartyType'
	       AND L.Item = 'CivilPartnership'
	       AND LV.Culture = @Culture
	
	SELECT @GovernmentalLegalPerson = LV.Value
	FROM   CFG.LocalizeEnum L
	       JOIN CFG.LocalizeEnumValue LV
	            ON  L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE  L.Enum = 'PartyType'
	       AND L.Item = 'GovernmentalLegalPerson'
	       AND LV.Culture = @Culture
	SET @UserID=cfg.GetuserID()
	
	
	SELECT p.PartyID,
	       p.[Type],
	       CASE p.[Type]
	            WHEN 0 THEN @NaturalPerson
	            WHEN 1 THEN @NonGovernmentalLegalPerson
	            WHEN 2 THEN @GovernmentalLegalPerson
				WHEN 4 THEN @CivilPartnership
	       END                     AS PartyTypeName,	       
		   case when @CultureNo = 1 then p.Title
			    when @CultureNo = 2 then p.Title2
		   end as Title,
	       p.IdentificationCode,
	       p.RegisterCode,
	       p.EconomicCode,
	       p.IsActive,
	       p.IsInBlackList,
	       p.IsCustomer,
	       p.CreditControl,
	       p.CustomerCredit,
	       p.IsDetterent,
	       p.IsVendor,
	     
	       p.ExemptFromTax,
	       
	       p.CustomerCode,
	       p.NationalID,	       
		   case when @CultureNo = 1 then p.LastName
	            when @CultureNo = 2 then p.LastName2
	       end as LastName,
	       d.Code                  AS DlCode,
		   case when @CultureNo = 1 then d.Title
			    when @CultureNo = 2 then d.Title2
		   end as DlTitle,	       
		   case when @CultureNo = 1 then g.Title
			    when @CultureNo = 2 then g.Title2
		   end as CustomerGroupName,
		  
	       p.IntroductionName,
		   case when @CultureNo = 1 then g2.Title
			    when @CultureNo = 2 then g2.Title2
		   end as VendorGroupName,
	       p.Email,
	       p.IsReceptionist,
		   case when @CultureNo = 1 then p.TradeName
	            when @CultureNo = 2 then p.TradeName2
	       end as TradeName,
	       a.ZipCode, a.[Address],
		   case when @CultureNo = 1 then l.Title
			    when @CultureNo = 2 then l.Title2
		   end as CityTitle,
	       ph.Phone
	FROM   CFG.Party               AS p
	       LEFT JOIN ACC.DL d
	            ON  d.DLID = p.DlID
	       LEFT JOIN CFG.[Group] g
	            ON  g.GroupID = p.CustomerGroupID
	      
	       LEFT JOIN CFG.[Group] g2
	            ON  g2.GroupID = p.VendorGroupID
	       LEFT JOIN CFG.Introduction i
	            ON  i.IntroductionID = p.IntroductionID
	       LEFT JOIN (
	                SELECT a.PartyID,
						   case when @CultureNo = 1 then at.Title
			                    when @CultureNo = 2 then at.Title2
		                   end as AddressType,
	                       a.LocationID,
	                       a.[Address],
	                       a.ZipCode,
	                       ROW_NUMBER() OVER(PARTITION BY a.PartyID ORDER BY a.AddressID) AS Rno
	                FROM   cfg.[Address] AS a
					join cfg.AddressType at on a.AddressTypeID = at.AddressTypeID
	                WHERE  a.IsMain = 1
	            )A
	            ON  A.PartyID = p.PartyID
	            AND a.Rno = 1
	       LEFT JOIN (
	                SELECT p2.PartyID,
						   case when @CultureNo = 1 then at.Title
			                    when @CultureNo = 2 then at.Title2
		                   end as PhoneType,
	                       p2.Phone,
	                       ROW_NUMBER() OVER(PARTITION BY p2.PartyID ORDER BY p2.PhoneID)
	                       Rno
	                FROM   cfg.Phone AS p2
					join cfg.AddressType at on at.AddressTypeID = p2.AddressTypeID
	                WHERE  p2.IsMain = 1
	            ) ph
	            ON  p.PartyID = ph.PartyID
	            AND ph.rno = 1
	       LEFT JOIN cfg.Location  AS l
	            ON  l.LocationID = A.LocationID
			INNER JOIN cfg.vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
