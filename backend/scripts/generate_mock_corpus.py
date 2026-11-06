import os
from pathlib import Path
import textwrap

def create_doc(filepath, source_id, title, source_type, page_count, pub_date, authority, body):
    header = textwrap.dedent(f"""\
        ---
        SOURCE_ID: {source_id}
        TITLE: {title}
        SOURCE_TYPE: {source_type}
        PAGE_COUNT: {page_count}
        PUBLICATION_DATE: {pub_date}
        SYNTHETIC: true
        ISSUING_AUTHORITY: {authority}
        ---
        """)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(header + "\n" + textwrap.dedent(body).strip() + "\n")

def generate_corpus(docs_dir):
    docs_dir = Path(docs_dir)
    
    dirs = ['dgms', 'regulations', 'sops', 'reports']
    for d in dirs:
        (docs_dir / d).mkdir(parents=True, exist_ok=True)
    
    # DGMS Circulars
    create_doc(
        docs_dir / 'dgms' / 'DGMS-CIR-2024-01.txt',
        'DGMS-CIR-2024-01',
        'Guidelines for Operation of Heavy Earth Moving Machinery (HEMM)',
        'DGMS Circular',
        5,
        '2024-01-15',
        'Directorate General of Mines Safety, Dhanbad',
        """
        1. Purpose: To ensure safe operation of HEMM in open cast mines.
        2. Scope: Applies to all dumpers, excavators, dozers, and graders.
        3. Guidelines:
           3.1. Pre-shift inspection is mandatory. Brakes, steering, and lights must be checked.
           3.2. Maximum speed limit for dumpers on haul roads is 30 km/h. Near loading/unloading points, it is restricted to 15 km/h.
           3.3. Reverse horns and proximity sensors are mandatory for all HEMM.
           3.4. Dust suppression measures, including water sprinkling, must be strictly enforced on all haul roads.
        4. Compliance: Non-compliance will result in immediate suspension of operations.
        """
    )
    
    create_doc(
        docs_dir / 'dgms' / 'DGMS-CIR-2023-12.txt',
        'DGMS-CIR-2023-12',
        'Safety Standards for Electrical Installations in Underground Coal Mines',
        'DGMS Circular',
        8,
        '2023-11-20',
        'Directorate General of Mines Safety, Dhanbad',
        """
        1. All electrical cables used underground must be flame-retardant.
        2. Earth leakage relays must be installed at all substations and tested monthly.
        3. Switchgears must have intrinsically safe circuits for control and interlock.
        4. Clearances: A minimum clearance of 1.5 meters must be maintained around electrical panels.
        5. Any electrical breakdown must be reported immediately to the electrical supervisor.
        """
    )

    # Regulations
    create_doc(
        docs_dir / 'regulations' / 'CMR-2017-Ch-11.txt',
        'CMR-2017-Ch-11',
        'Coal Mines Regulations 2017 - Chapter XI: Precautions against Danger from Fire, Dust, Gas and Water',
        'Statutory Regulation',
        20,
        '2017-09-01',
        'Ministry of Labour and Employment, Govt. of India',
        """
        Regulation 133: Precautions against fire
        1. No person shall light a fire or use a naked light in any underground part of a coal mine.
        2. Suitable fire extinguishers shall be kept readily available at strategic locations.
        
        Regulation 137: Precautions against coal dust
        1. Adequate steps shall be taken to minimize the generation of coal dust.
        2. Accumulation of coal dust on roof, floor, and sides shall be cleared periodically.
        3. Stone dusting shall be done to maintain the incombustible content of dust at not less than 75%.
        
        Regulation 149: Precautions against danger of inundation
        1. No working shall be made within 60 meters of any water body without prior permission from the Regional Inspector.
        """
    )

    # SOPs
    create_doc(
        docs_dir / 'sops' / 'CCL-SOP-HEMM-01.txt',
        'CCL-SOP-HEMM-01',
        'Standard Operating Procedure for Dumper Operations in Open Cast Mines',
        'Standard Operating Procedure',
        4,
        '2023-05-10',
        'Central Coalfields Limited (CCL)',
        """
        1. Objective: Standardize safe dumper operation procedures.
        2. Pre-operation checks:
           - Check engine oil, coolant, and transmission fluid levels.
           - Ensure tires are properly inflated and have no visible damage.
           - Verify that the reverse alarm and camera are functioning.
        3. Loading:
           - Wait for the excavator operator's signal before approaching.
           - Do not overload the dumper.
        4. Dumping:
           - Approach the dump edge perpendicularly.
           - Maintain a distance of at least 3 meters from the crest.
           - Wait for the spotter's signal to dump.
        5. Emergency: In case of brake failure, steer the dumper towards the runaway ramp or a pile of loose material.
        """
    )
    
    create_doc(
        docs_dir / 'sops' / 'CCL-SOP-BLAST-02.txt',
        'CCL-SOP-BLAST-02',
        'SOP for Drilling and Blasting',
        'Standard Operating Procedure',
        6,
        '2022-08-15',
        'Central Coalfields Limited (CCL)',
        """
        1. Blasting shall only be performed by a certified blaster.
        2. The danger zone (500 meters radius) must be cleared of all personnel and machinery before blasting.
        3. Warning sirens must be sounded 5 minutes before the blast, and 1 minute before the blast.
        4. Misfires must be handled cautiously. No one shall enter the blast area for at least 30 minutes after a suspected misfire.
        5. Explosives must be transported in approved explosive vans.
        """
    )

    # Reports
    create_doc(
        docs_dir / 'reports' / 'SHIFT-REP-2024-05-10-A.txt',
        'SHIFT-REP-2024-05-10-A',
        'Shift Report - Shift A, Mine XYZ',
        'Shift Report',
        2,
        '2024-05-10',
        'Shift Incharge, Mine XYZ',
        """
        Date: 2024-05-10
        Shift: A (06:00 - 14:00)
        
        Production:
        - Coal: 1500 Tonnes
        - Overburden: 4500 Cubic Meters
        
        Safety Incidents:
        - Near Miss: Dumper no. D-14 experienced steering stiffness near the main haul road curve at 10:30 AM. Maintenance team notified.
        
        Maintenance:
        - Excavator EX-03 was down for scheduled maintenance (hydraulic oil change) from 08:00 to 11:00.
        
        Notes:
        - Dust levels were high near loading point 2. Requested additional water sprinkler deployment for Shift B.
        """
    )

if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent.parent
    docs_dir = base_dir / 'documents'
    print(f"Generating mock corpus in {docs_dir}...")
    generate_corpus(docs_dir)
    print("Generation complete.")
