CREATE       proc [HRM].GetEmployeeSharePerDate
( 
@FromDate Date ,
@EndDate Date ,
@All  BIT
)
as
	declare	@User int = cfg.GetuserID() ,
			@DateType TINYINT,
			@DateFormat VARCHAR(10),
			@PersonnelID int

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @User
	IF @DateType IS NULL
	SET @DateType = CASE cfg.GetuserCulture() WHEN 'fa' THEN 0	
											  WHEN 'en' THEN 1
											  WHEN 'ar' THEN 2 END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID =  @User
		   
SELECT @PersonnelID=p.PersonelID FROM hrm.Personel AS p
JOIN cfg.Party AS p2 ON p2.PartyID = p.PartyID
JOIN cfg.[User] AS u ON p2.PartyID=u.PartyID
	       
	IF @DateFormat IS NULL
	SET @DATEFORMAT = 'YY/MM/DD'

	select  fo.PersonnelID,
			fo.Date,
			f.FoodTypeID,
			foi.Amount FoodPrice,
			es.EmployerShareID,
			es.Level EmployerShareLevel
	into #Detail
	from hrm.FoodOrder fo
	join hrm.FoodOrderItem foi on fo.FoodOrderID = foi.FoodOrderID
	join hrm.Food f on f.FoodID = foi.FoodID
	outer apply
	(
	select top 1 *
	from hrm.EmployerShare
	where date <= fo.Date
	and (FoodTypeID is null or FoodTypeID = f.FoodTypeID)
	order by Date desc
	)es
	where fo.Date between @FromDate and @EndDate




		select  personelid,
			SUM(case when b.Type = 2 then FoodPrice - b.Amount
				 when b.Type = 1 then FoodPrice * (1-Amount/100)
			END) EmployeeCost,
			SUM(FoodPrice)  FoodPrice,
			a.date
	from
		(
		SELECT personnelID,Date,EmployerShareID,sum(FoodPrice) FoodPrice
		from #Detail
		where EmployerShareLevel = 2 
		group by personnelID,Date,EmployerShareID
		union all
		select personnelID,Date,EmployerShareID,sum(FoodPrice) FoodPrice
		from #Detail
		where EmployerShareLevel = 1 
		group by PersonnelID,Date,FoodTypeID,EmployerShareID
		)a
	join hrm.EmployerShare b on a.EmployerShareID = b.EmployerShareID
	join hrm.Personel AS p ON a.PersonnelID=p.PersonelID
	JOIN cfg.Party AS p2 ON p2.PartyID = p.PartyID
	JOIN cfg.[User] AS u ON p2.PartyID=u.PartyID
		WHERE @All=1 OR u.UserID=cfg.GetuserID()
		GROUP BY personelid,a.DATE
