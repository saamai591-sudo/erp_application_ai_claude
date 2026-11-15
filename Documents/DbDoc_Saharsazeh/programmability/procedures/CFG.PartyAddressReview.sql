CREATE    PROCEDURE [CFG].[PartyAddressReview]
(@SelectedParties VARCHAR(MAX) = NULL)
AS
	DECLARE @Culture VARCHAR(10),
	        @CultureNo tinyint,
	        @UserID INT
	
	SELECT @Culture = Cfg.GetuserCulture()
	SET @UserID = cfg.GetuserID()
	
	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture
	
	SELECT VALUE AS PartyID
	INTO   #SelectedParties
	FROM   CFG.R_FnCommaStr2Table(@SelectedParties)	
	
	    SELECT a.PartyID,
	           a.AddressID,	
			   case @CultureNo 
					when 2 then at.Title2
	                else at.Title
	           end as AddressType,		   			  
	           a.LocationID,	           
			   case @CultureNo 
					when 2 then a.Address2
	                else a.[Address]
	           end as [Address],
	           a.ZipCode,
	           a.IsMain,			   
			   case @CultureNo 
			        when 2 then l.Title2
	                else l.Title
	           end as City,
			   case @CultureNo
			        when 2 then p.Title2
	                else p.Title
	           end as Title,	            	           
			   case @CultureNo
			        when 2 then p.LastName2
	                else p.LastName
	           end as LastName,
	           d.Code AS DlCode
	    FROM   cfg.[Address]            AS a
	           INNER JOIN CFG.Location  AS l
	                ON  l.LocationID = a.LocationID
	           INNER JOIN CFG.Party     AS p
	                ON  p.PartyID = a.PartyID
	           INNER JOIN ACC.DL        AS d
	                ON  d.DLID = p.DlID
	           INNER JOIN CFG.AddressType at
	                ON  at.AddressTypeID = a.AddressTypeID
	                   LEFT JOIN #SelectedParties sp 
	       ON p.PartyID=sp.PartyID
		INNER JOIN cfg.vwPartyAccess AS vpa ON vpa.PartyID = p.PartyID
	WHERE 
	(@SelectedParties IS NULL OR sp.PartyID IS NOT NULL)    
